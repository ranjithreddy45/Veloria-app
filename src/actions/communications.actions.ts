"use server";

// ============================================================
// Communications — Unified Inbox (read-only aggregation)
// ------------------------------------------------------------
// Merges every customer-touching channel into ONE chronological
// timeline (per-contact or global feed) plus per-channel stats.
//
// Sources merged:
//   - Communication       (NOTE | CALL | EMAIL | SMS | MEETING | WHATSAPP)
//   - CallLog             (call dispositions; channel = CALL)
//   - WhatsAppMessage     (channel = WHATSAPP)
//   - SmsMessage          (channel = SMS)
//   - EmailTrackingEvent  (email opens / link clicks; channel = EMAIL)
//
// This module is strictly READ-ONLY. Every source is wrapped in its
// own try/catch so a single failing query degrades that channel to
// empty rather than crashing the whole timeline.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

// ------------------------------------------------------------
// Normalized DTO — one shape for every channel.
// ------------------------------------------------------------
export type CommsChannel =
  | "CALL"
  | "EMAIL"
  | "WHATSAPP"
  | "SMS"
  | "MEETING"
  | "NOTE";

export type CommsDirection = "INBOUND" | "OUTBOUND";

export interface CommsTimelineItem {
  id: string;
  channel: CommsChannel;
  direction: CommsDirection;
  summary: string;
  status?: string;
  at: string; // ISO 8601
  contactId?: string;
  contactName?: string;
  actorName?: string;
}

export interface CommsStats {
  call: number;
  email: number;
  whatsapp: number;
  sms: number;
  note: number;
  meeting: number;
  total: number;
}

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const DEFAULT_LIMIT = 100;

function toIso(d: Date | null | undefined): string {
  return (d ?? new Date()).toISOString();
}

function truncate(text: string | null | undefined, max = 160): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function mapCommunicationChannel(type: string): CommsChannel {
  switch (type) {
    case "CALL":
      return "CALL";
    case "EMAIL":
      return "EMAIL";
    case "SMS":
      return "SMS";
    case "MEETING":
      return "MEETING";
    case "WHATSAPP":
      return "WHATSAPP";
    case "NOTE":
    default:
      return "NOTE";
  }
}

// ============================================================
// getCommsTimeline — merged, normalized, sorted-desc, capped feed.
// ============================================================
export async function getCommsTimeline(params: {
  contactId?: string;
  channel?: CommsChannel;
  limit?: number;
} = {}): Promise<ActionResult<CommsTimelineItem[]>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }
  const role = (session.user as { role?: string }).role ?? "";
  if (!hasPermission(role, "communications:read")) {
    return { success: false, error: "Insufficient permissions" };
  }

  const { contactId, channel } = params;
  const limit = Math.max(1, Math.min(params.limit ?? DEFAULT_LIMIT, 500));
  // Over-fetch per source so the merged+capped result is accurate.
  const perSource = limit;

  const items: CommsTimelineItem[] = [];
  const userIds = new Set<string>();
  const contactIds = new Set<string>();

  const wantChannel = (c: CommsChannel) => !channel || channel === c;

  // --- Source 1: Communication (covers CALL/EMAIL/SMS/MEETING/WHATSAPP/NOTE) ---
  try {
    // If a specific channel is requested, map it back to the Communication type.
    const typeFilter =
      channel === "CALL"
        ? "CALL"
        : channel === "EMAIL"
          ? "EMAIL"
          : channel === "WHATSAPP"
            ? "WHATSAPP"
            : channel === "SMS"
              ? "SMS"
              : channel === "MEETING"
                ? "MEETING"
                : channel === "NOTE"
                  ? "NOTE"
                  : undefined;

    const comms = await prisma.communication.findMany({
      where: {
        ...(contactId ? { contactId } : {}),
        ...(typeFilter ? { type: typeFilter as never } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: perSource,
      select: {
        id: true,
        type: true,
        direction: true,
        subject: true,
        content: true,
        createdAt: true,
        contactId: true,
        createdById: true,
      },
    });

    for (const c of comms) {
      if (c.createdById) userIds.add(c.createdById);
      if (c.contactId) contactIds.add(c.contactId);
      const summaryBody = c.subject ? `${c.subject} — ${c.content}` : c.content;
      items.push({
        id: `comm_${c.id}`,
        channel: mapCommunicationChannel(c.type),
        direction: c.direction as CommsDirection,
        summary: truncate(summaryBody) || "(no content)",
        at: toIso(c.createdAt),
        contactId: c.contactId ?? undefined,
        actorName: undefined,
        // resolved below
        contactName: undefined,
        // actorId stashed for batch-resolve
        ...({ _actorId: c.createdById } as object),
      });
    }
  } catch {
    // Communication source unavailable — degrade to empty.
  }

  // --- Source 2: CallLog (channel = CALL) ---
  if (wantChannel("CALL")) {
    try {
      const calls = await prisma.callLog.findMany({
        where: { ...(contactId ? { contactId } : {}) },
        orderBy: { createdAt: "desc" },
        take: perSource,
        select: {
          id: true,
          disposition: true,
          durationSeconds: true,
          notes: true,
          createdAt: true,
          contactId: true,
          agentId: true,
        },
      });

      for (const c of calls) {
        if (c.agentId) userIds.add(c.agentId);
        if (c.contactId) contactIds.add(c.contactId);
        const mins = Math.floor((c.durationSeconds ?? 0) / 60);
        const secs = (c.durationSeconds ?? 0) % 60;
        const durLabel =
          (c.durationSeconds ?? 0) > 0 ? ` (${mins}m ${secs}s)` : "";
        const note = c.notes ? ` — ${truncate(c.notes, 120)}` : "";
        items.push({
          id: `call_${c.id}`,
          channel: "CALL",
          // CallLog has no explicit direction; treat as OUTBOUND (agent-initiated default).
          direction: "OUTBOUND",
          summary: `Call: ${c.disposition}${durLabel}${note}`,
          status: c.disposition,
          at: toIso(c.createdAt),
          contactId: c.contactId ?? undefined,
          ...({ _actorId: c.agentId } as object),
        });
      }
    } catch {
      // CallLog source unavailable — degrade to empty.
    }
  }

  // --- Source 3: WhatsAppMessage (channel = WHATSAPP) ---
  if (wantChannel("WHATSAPP")) {
    try {
      const wa = await prisma.whatsAppMessage.findMany({
        where: { ...(contactId ? { contactId } : {}) },
        orderBy: { sentAt: "desc" },
        take: perSource,
        select: {
          id: true,
          direction: true,
          content: true,
          status: true,
          sentAt: true,
          contactId: true,
        },
      });

      for (const m of wa) {
        if (m.contactId) contactIds.add(m.contactId);
        items.push({
          id: `wa_${m.id}`,
          channel: "WHATSAPP",
          direction: m.direction as CommsDirection,
          summary: truncate(m.content) || "(no content)",
          status: m.status,
          at: toIso(m.sentAt),
          contactId: m.contactId ?? undefined,
        });
      }
    } catch {
      // WhatsApp source unavailable — degrade to empty.
    }
  }

  // --- Source 4: SmsMessage (channel = SMS) ---
  if (wantChannel("SMS")) {
    try {
      const sms = await prisma.smsMessage.findMany({
        where: { ...(contactId ? { contactId } : {}) },
        orderBy: { sentAt: "desc" },
        take: perSource,
        select: {
          id: true,
          direction: true,
          content: true,
          status: true,
          sentAt: true,
          contactId: true,
        },
      });

      for (const m of sms) {
        if (m.contactId) contactIds.add(m.contactId);
        items.push({
          id: `sms_${m.id}`,
          channel: "SMS",
          direction: m.direction as CommsDirection,
          summary: truncate(m.content) || "(no content)",
          status: m.status,
          at: toIso(m.sentAt),
          contactId: m.contactId ?? undefined,
        });
      }
    } catch {
      // SMS source unavailable — degrade to empty.
    }
  }

  // --- Source 5: EmailTrackingEvent (channel = EMAIL; opens / link clicks) ---
  if (wantChannel("EMAIL")) {
    try {
      const events = await prisma.emailTrackingEvent.findMany({
        where: {
          ...(contactId ? { pixel: { contactId } } : {}),
        },
        orderBy: { occurredAt: "desc" },
        take: perSource,
        select: {
          id: true,
          type: true,
          linkUrl: true,
          occurredAt: true,
          pixel: { select: { contactId: true, recipientEmail: true } },
        },
      });

      for (const e of events) {
        const ctId = e.pixel?.contactId ?? undefined;
        if (ctId) contactIds.add(ctId);
        const label =
          e.type === "LINK_CLICK"
            ? `Email link clicked${e.linkUrl ? `: ${truncate(e.linkUrl, 80)}` : ""}`
            : "Email opened";
        items.push({
          id: `email_${e.id}`,
          channel: "EMAIL",
          // Tracking events are recipient-side actions → INBOUND engagement.
          direction: "INBOUND",
          summary: e.pixel?.recipientEmail
            ? `${label} (${e.pixel.recipientEmail})`
            : label,
          status: e.type,
          at: toIso(e.occurredAt),
          contactId: ctId,
        });
      }
    } catch {
      // Email-tracking source unavailable — degrade to empty.
    }
  }

  // --- Batch-resolve actor (User) + contact names ---
  let userMap = new Map<string, string>();
  let contactMap = new Map<string, string>();

  try {
    if (userIds.size > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: [...userIds] } },
        select: { id: true, name: true, email: true },
      });
      userMap = new Map(
        users.map((u) => [u.id, u.name || u.email || "Unknown"])
      );
    }
  } catch {
    // name resolution best-effort
  }

  try {
    if (contactIds.size > 0) {
      const contacts = await prisma.contact.findMany({
        where: { id: { in: [...contactIds] } },
        select: { id: true, firstName: true, lastName: true },
      });
      contactMap = new Map(
        contacts.map((c) => [
          c.id,
          `${c.firstName} ${c.lastName}`.trim() || "Unknown",
        ])
      );
    }
  } catch {
    // name resolution best-effort
  }

  for (const it of items) {
    const actorId = (it as { _actorId?: string })._actorId;
    if (actorId) it.actorName = userMap.get(actorId);
    if (it.contactId) it.contactName = contactMap.get(it.contactId);
    delete (it as { _actorId?: string })._actorId;
  }

  // --- Sort desc by `at`, then cap ---
  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  return { success: true, data: items.slice(0, limit) };
}

// ============================================================
// getCommsStats — per-channel counts for the current month.
// ============================================================
export async function getCommsStats(): Promise<ActionResult<CommsStats>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }
  const role = (session.user as { role?: string }).role ?? "";
  if (!hasPermission(role, "communications:read")) {
    return { success: false, error: "Insufficient permissions" };
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const stats: CommsStats = {
    call: 0,
    email: 0,
    whatsapp: 0,
    sms: 0,
    note: 0,
    meeting: 0,
    total: 0,
  };

  // Communication counts grouped by type (this month).
  try {
    const grouped = await prisma.communication.groupBy({
      by: ["type"],
      where: { createdAt: { gte: monthStart } },
      _count: { _all: true },
    });
    for (const g of grouped) {
      const n = g._count._all;
      switch (g.type) {
        case "CALL":
          stats.call += n;
          break;
        case "EMAIL":
          stats.email += n;
          break;
        case "WHATSAPP":
          stats.whatsapp += n;
          break;
        case "SMS":
          stats.sms += n;
          break;
        case "MEETING":
          stats.meeting += n;
          break;
        case "NOTE":
          stats.note += n;
          break;
      }
    }
  } catch {
    // degrade silently
  }

  // CallLog (this month) — adds to call.
  try {
    stats.call += await prisma.callLog.count({
      where: { createdAt: { gte: monthStart } },
    });
  } catch {
    /* degrade */
  }

  // WhatsAppMessage (this month).
  try {
    stats.whatsapp += await prisma.whatsAppMessage.count({
      where: { sentAt: { gte: monthStart } },
    });
  } catch {
    /* degrade */
  }

  // SmsMessage (this month).
  try {
    stats.sms += await prisma.smsMessage.count({
      where: { sentAt: { gte: monthStart } },
    });
  } catch {
    /* degrade */
  }

  // EmailTrackingEvent (this month) — engagement adds to email.
  try {
    stats.email += await prisma.emailTrackingEvent.count({
      where: { occurredAt: { gte: monthStart } },
    });
  } catch {
    /* degrade */
  }

  stats.total =
    stats.call +
    stats.email +
    stats.whatsapp +
    stats.sms +
    stats.note +
    stats.meeting;

  return { success: true, data: stats };
}
