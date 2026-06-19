"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";
import { otaChannelSchema, type OtaChannelInput } from "@/schemas/ota.schema";
import { buildAvailabilityJson, type AvailabilityFeed } from "@/lib/ota/feed";
import type { OtaChannel, OtaSyncLog, Prisma } from "@prisma/client";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const SETTINGS_PATH = "/settings/integrations/ota";

// Read paths gate on settings:read; write paths additionally require settings:update.
// (Recommended ota:read / ota:manage perms are noted in sharedEditsNeeded; this
// feature is gated on the existing settings perms so it works without that edit.)
async function requireRead() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || !hasPermission(role ?? "", "settings:read")) {
    return null;
  }
  return { userId: session.user.id, role: role ?? "" };
}

async function requireWrite() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || !hasPermission(role ?? "", "settings:update")) {
    return null;
  }
  return { userId: session.user.id, role: role ?? "" };
}

// ============================================================
// Read: list all channels
// ============================================================
export async function getOtaChannels(): Promise<Result<OtaChannel[]>> {
  try {
    const ctx = await requireRead();
    if (!ctx) return { success: false, error: "Unauthorized" };

    const channels = await prisma.otaChannel.findMany({
      orderBy: { createdAt: "asc" },
    });
    return { success: true, data: channels };
  } catch (error) {
    console.error("getOtaChannels error:", error);
    return { success: false, error: "Failed to fetch channels" };
  }
}

// ============================================================
// Read: single channel
// ============================================================
export async function getOtaChannel(id: string): Promise<Result<OtaChannel>> {
  try {
    const ctx = await requireRead();
    if (!ctx) return { success: false, error: "Unauthorized" };

    const channel = await prisma.otaChannel.findUnique({ where: { id } });
    if (!channel) return { success: false, error: "Channel not found" };
    return { success: true, data: channel };
  } catch (error) {
    console.error("getOtaChannel error:", error);
    return { success: false, error: "Failed to fetch channel" };
  }
}

// ============================================================
// Write: create / update a channel
// ============================================================
export async function upsertOtaChannel(input: OtaChannelInput): Promise<Result<OtaChannel>> {
  try {
    const ctx = await requireWrite();
    if (!ctx) return { success: false, error: "Unauthorized" };

    const parsed = otaChannelSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }
    const v = parsed.data;

    const common = {
      channelType: v.channelType,
      name: v.name,
      feedFormat: v.feedFormat,
      venueId: v.venueId,
      defaultSource: v.defaultSource,
      fieldMapping: v.fieldMapping as Prisma.InputJsonValue,
      credentials: v.credentials as Prisma.InputJsonValue,
      isActive: v.isActive,
    };

    let channel: OtaChannel;
    if (v.id) {
      // Update — preserve existing tokens (regenerate via the dedicated action).
      channel = await prisma.otaChannel.update({
        where: { id: v.id },
        data: common,
      });
      logActivity({
        userId: ctx.userId,
        action: "updated",
        entityType: "OtaChannel",
        entityId: channel.id,
        changes: { name: v.name, channelType: v.channelType },
      });
    } else {
      // Create — mint unguessable tokens for both feed + inbound endpoints.
      channel = await prisma.otaChannel.create({
        data: {
          ...common,
          feedToken: crypto.randomUUID(),
          inboundToken: crypto.randomUUID(),
        },
      });
      logActivity({
        userId: ctx.userId,
        action: "created",
        entityType: "OtaChannel",
        entityId: channel.id,
        changes: { name: v.name, channelType: v.channelType },
      });
    }

    revalidatePath(SETTINGS_PATH);
    return { success: true, data: channel };
  } catch (error) {
    console.error("upsertOtaChannel error:", error);
    return { success: false, error: "Failed to save channel" };
  }
}

// ============================================================
// Write: regenerate a feed / inbound token
// ============================================================
export async function regenerateChannelToken(
  id: string,
  which: "feed" | "inbound"
): Promise<Result<OtaChannel>> {
  try {
    const ctx = await requireWrite();
    if (!ctx) return { success: false, error: "Unauthorized" };

    const token = crypto.randomUUID();
    const channel = await prisma.otaChannel.update({
      where: { id },
      data: which === "feed" ? { feedToken: token } : { inboundToken: token },
    });

    logActivity({
      userId: ctx.userId,
      action: "updated",
      entityType: "OtaChannel",
      entityId: channel.id,
      changes: { regeneratedToken: which },
    });

    revalidatePath(SETTINGS_PATH);
    return { success: true, data: channel };
  } catch (error) {
    console.error("regenerateChannelToken error:", error);
    return { success: false, error: "Failed to regenerate token" };
  }
}

// ============================================================
// Write: delete a channel (cascades sync logs via FK? — delete logs first)
// ============================================================
export async function deleteOtaChannel(id: string): Promise<Result<null>> {
  try {
    const ctx = await requireWrite();
    if (!ctx) return { success: false, error: "Unauthorized" };

    // Remove dependent sync logs first (no onDelete cascade declared).
    await prisma.otaSyncLog.deleteMany({ where: { channelId: id } });
    await prisma.otaChannel.delete({ where: { id } });

    logActivity({
      userId: ctx.userId,
      action: "deleted",
      entityType: "OtaChannel",
      entityId: id,
    });

    revalidatePath(SETTINGS_PATH);
    return { success: true, data: null };
  } catch (error) {
    console.error("deleteOtaChannel error:", error);
    return { success: false, error: "Failed to delete channel" };
  }
}

// ============================================================
// Read: paginated sync logs for a channel
// ============================================================
const LOG_PAGE_SIZE = 20;

export async function getOtaSyncLogs(
  channelId: string,
  page = 1
): Promise<Result<{ logs: OtaSyncLog[]; total: number; page: number; pageSize: number }>> {
  try {
    const ctx = await requireRead();
    if (!ctx) return { success: false, error: "Unauthorized" };

    const safePage = Math.max(1, Math.floor(page) || 1);
    const [logs, total] = await Promise.all([
      prisma.otaSyncLog.findMany({
        where: { channelId },
        orderBy: { createdAt: "desc" },
        skip: (safePage - 1) * LOG_PAGE_SIZE,
        take: LOG_PAGE_SIZE,
      }),
      prisma.otaSyncLog.count({ where: { channelId } }),
    ]);

    return {
      success: true,
      data: { logs, total, page: safePage, pageSize: LOG_PAGE_SIZE },
    };
  } catch (error) {
    console.error("getOtaSyncLogs error:", error);
    return { success: false, error: "Failed to fetch sync logs" };
  }
}

// ============================================================
// Read: preview the JSON feed for the config UI (no token exposure)
// ============================================================
export async function buildFeedPreview(channelId: string): Promise<Result<AvailabilityFeed>> {
  try {
    const ctx = await requireRead();
    if (!ctx) return { success: false, error: "Unauthorized" };

    const channel = await prisma.otaChannel.findUnique({
      where: { id: channelId },
      select: { venueId: true },
    });
    if (!channel) return { success: false, error: "Channel not found" };
    if (!channel.venueId) {
      return { success: false, error: "Channel is not venue-scoped; set a venue to preview the feed" };
    }

    const from = new Date();
    const to = new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000); // 14-day preview window
    const feed = await buildAvailabilityJson(channel.venueId, from, to);
    if (!feed) {
      return { success: false, error: "Venue not found or inactive" };
    }
    return { success: true, data: feed };
  } catch (error) {
    console.error("buildFeedPreview error:", error);
    return { success: false, error: "Failed to build feed preview" };
  }
}
