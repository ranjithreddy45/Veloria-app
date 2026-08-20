"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ============================================================
// Internal team chat — channels + DMs between staff.
// Available to ALL internal staff (everyone except CLIENT / VENDOR).
// ============================================================

const EXTERNAL_ROLES = new Set(["CLIENT", "VENDOR"]);
function isInternal(role?: string | null): boolean {
  return !!role && !EXTERNAL_ROLES.has(role);
}

async function requireStaff() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || !isInternal(role)) return null;
  return { id: session.user.id as string, name: session.user.name ?? "", role: role as string };
}

/** Sorted-pair key so a DM between two users is unique regardless of who starts it. */
function dmKeyFor(a: string, b: string): string {
  return [a, b].sort().join(":");
}

export interface ChatUserLite {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
}

/** Internal teammates you can start a chat with (everyone active but you). */
export async function listChatUsers() {
  const me = await requireStaff();
  if (!me) return { success: false as const, error: "Unauthorized" };
  const users = await prisma.user.findMany({
    where: { isActive: true, id: { not: me.id }, role: { notIn: ["CLIENT", "VENDOR"] } },
    select: { id: true, name: true, email: true, image: true, role: true },
    orderBy: { name: "asc" },
  });
  return { success: true as const, data: users as ChatUserLite[] };
}

export interface ChannelSummary {
  id: string;
  type: "DIRECT" | "GROUP";
  displayName: string;
  avatarName: string; // whose initials to show (other member for DMs; group name)
  lastMessage: string;
  lastMessageAt: string | null;
  lastSenderIsMe: boolean;
  unread: number;
  memberCount: number;
}

export async function listChannels() {
  const me = await requireStaff();
  if (!me) return { success: false as const, error: "Unauthorized" };

  const memberships = await prisma.chatChannelMember.findMany({
    where: { userId: me.id },
    select: {
      lastReadAt: true,
      channel: {
        select: {
          id: true,
          type: true,
          name: true,
          updatedAt: true,
          members: {
            select: { userId: true, user: { select: { id: true, name: true, email: true } } },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { body: true, createdAt: true, senderId: true },
          },
        },
      },
    },
  });

  const summaries = await Promise.all(
    memberships.map(async (m) => {
      const c = m.channel;
      const other = c.members.find((mm) => mm.userId !== me.id)?.user;
      const displayName =
        c.type === "DIRECT" ? other?.name || other?.email || "Direct message" : c.name || "Channel";
      const last = c.messages[0];
      const unread = await prisma.chatMessage.count({
        where: {
          channelId: c.id,
          senderId: { not: me.id },
          ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
        },
      });
      return {
        id: c.id,
        type: c.type,
        displayName,
        avatarName: displayName,
        lastMessage: last?.body?.slice(0, 120) ?? "",
        lastMessageAt: last?.createdAt?.toISOString() ?? c.updatedAt.toISOString(),
        lastSenderIsMe: last?.senderId === me.id,
        unread,
        memberCount: c.members.length,
      } as ChannelSummary;
    })
  );

  summaries.sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
  return { success: true as const, data: summaries };
}

/** Open (or create) the 1:1 channel between me and another user. */
export async function getOrCreateDirectChannel(otherUserId: string) {
  const me = await requireStaff();
  if (!me) return { success: false as const, error: "Unauthorized" };
  if (otherUserId === me.id) return { success: false as const, error: "Can't DM yourself" };

  const other = await prisma.user.findFirst({
    where: { id: otherUserId, isActive: true, role: { notIn: ["CLIENT", "VENDOR"] } },
    select: { id: true },
  });
  if (!other) return { success: false as const, error: "User not found" };

  const key = dmKeyFor(me.id, otherUserId);
  const existing = await prisma.chatChannel.findUnique({ where: { dmKey: key }, select: { id: true } });
  if (existing) return { success: true as const, data: { id: existing.id } };

  const channel = await prisma.chatChannel.create({
    data: {
      type: "DIRECT",
      dmKey: key,
      createdById: me.id,
      members: { create: [{ userId: me.id }, { userId: otherUserId }] },
    },
    select: { id: true },
  });
  revalidatePath("/chat");
  return { success: true as const, data: { id: channel.id } };
}

export async function createGroupChannel(name: string, memberIds: string[]) {
  const me = await requireStaff();
  if (!me) return { success: false as const, error: "Unauthorized" };
  const trimmed = name.trim();
  if (!trimmed) return { success: false as const, error: "Channel name is required" };

  // Only real internal users, always include the creator, de-dupe.
  const valid = await prisma.user.findMany({
    where: { id: { in: memberIds }, isActive: true, role: { notIn: ["CLIENT", "VENDOR"] } },
    select: { id: true },
  });
  const ids = Array.from(new Set([me.id, ...valid.map((u) => u.id)]));

  const channel = await prisma.chatChannel.create({
    data: {
      type: "GROUP",
      name: trimmed.slice(0, 80),
      createdById: me.id,
      members: { create: ids.map((userId) => ({ userId })) },
    },
    select: { id: true },
  });
  revalidatePath("/chat");
  return { success: true as const, data: { id: channel.id } };
}

async function isMember(channelId: string, userId: string): Promise<boolean> {
  const m = await prisma.chatChannelMember.findUnique({
    where: { channelId_userId: { channelId, userId } },
    select: { id: true },
  });
  return !!m;
}

export interface ChatMessageDto {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  senderName: string;
  mine: boolean;
}

export async function getChatMessages(channelId: string) {
  const me = await requireStaff();
  if (!me) return { success: false as const, error: "Unauthorized" };
  if (!(await isMember(channelId, me.id))) {
    return { success: false as const, error: "Not a member of this channel" };
  }

  const [channel, messages] = await Promise.all([
    prisma.chatChannel.findUnique({
      where: { id: channelId },
      select: {
        id: true,
        type: true,
        name: true,
        members: { select: { userId: true, user: { select: { id: true, name: true, email: true } } } },
      },
    }),
    prisma.chatMessage.findMany({
      where: { channelId },
      orderBy: { createdAt: "asc" },
      take: 500,
      select: {
        id: true,
        body: true,
        createdAt: true,
        senderId: true,
        sender: { select: { name: true, email: true } },
      },
    }),
  ]);

  // Mark read up to now.
  await prisma.chatChannelMember.update({
    where: { channelId_userId: { channelId, userId: me.id } },
    data: { lastReadAt: new Date() },
  });

  const other = channel?.members.find((m) => m.userId !== me.id)?.user;
  const title =
    channel?.type === "DIRECT" ? other?.name || other?.email || "Direct message" : channel?.name || "Channel";

  return {
    success: true as const,
    data: {
      title,
      type: channel?.type ?? "GROUP",
      memberCount: channel?.members.length ?? 0,
      messages: messages.map((m) => ({
        id: m.id,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        senderId: m.senderId,
        senderName: m.sender.name || m.sender.email,
        mine: m.senderId === me.id,
      })) as ChatMessageDto[],
    },
  };
}

export async function sendChatMessage(channelId: string, body: string) {
  const me = await requireStaff();
  if (!me) return { success: false as const, error: "Unauthorized" };
  const text = body.trim();
  if (!text) return { success: false as const, error: "Empty message" };
  if (text.length > 4000) return { success: false as const, error: "Message too long" };
  if (!(await isMember(channelId, me.id))) {
    return { success: false as const, error: "Not a member of this channel" };
  }

  const msg = await prisma.chatMessage.create({
    data: { channelId, senderId: me.id, body: text },
    select: { id: true, createdAt: true },
  });

  // Bump activity + keep my own read pointer current.
  await Promise.all([
    prisma.chatChannel.update({ where: { id: channelId }, data: { updatedAt: new Date() } }),
    prisma.chatChannelMember.update({
      where: { channelId_userId: { channelId, userId: me.id } },
      data: { lastReadAt: new Date() },
    }),
  ]);

  // No per-message bell notification: it would create a Notification row per
  // recipient per message (thousands fast) and spam the bell. Unread state is
  // carried by the chat's own per-channel badges instead.

  revalidatePath("/chat");
  return { success: true as const, data: { id: msg.id } };
}

export async function markChannelRead(channelId: string) {
  const me = await requireStaff();
  if (!me) return { success: false as const, error: "Unauthorized" };
  try {
    await prisma.chatChannelMember.update({
      where: { channelId_userId: { channelId, userId: me.id } },
      data: { lastReadAt: new Date() },
    });
  } catch {
    // not a member — ignore
  }
  return { success: true as const };
}
