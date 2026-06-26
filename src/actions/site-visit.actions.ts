"use server";

// ============================================================
// Site-visit management — INTERNAL (gated). Powers /site-visits.
// ------------------------------------------------------------
// Every export gates at the top via auth() + hasPermission. Generalises the BD
// AcqSiteVisit status machine (SCHEDULED/COMPLETED/CANCELLED/NO_SHOW/
// RESCHEDULED) onto SiteVisitBooking. Read = tastings:read; mutations =
// tastings:update. Exports only async functions; revalidates /site-visits.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";
import { notifyAwait } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { revalidatePath } from "next/cache";
import type { SiteVisitStatus, SiteVisitKind } from "@prisma/client";
import {
  updateSiteVisitStatusSchema,
  type UpdateSiteVisitStatusInput,
} from "@/schemas/site-visit.schema";
import {
  isValidVisitSlot,
  formatVisitDateLabel,
  formatVisitTimeLabel,
  SITE_VISIT_KIND_LABEL,
} from "@/lib/site-visit/slots";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function gate(perm: string): Promise<
  { ok: true; user: { id: string; role: string; name: string | null } } | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  const role = (session.user.role as string) || "";
  if (!hasPermission(role, perm)) return { ok: false, error: "Insufficient permissions" };
  return {
    ok: true,
    user: { id: session.user.id, role, name: session.user.name ?? null },
  };
}

export interface SiteVisitRow {
  id: string;
  token: string;
  kind: SiteVisitKind;
  kindLabel: string;
  status: SiteVisitStatus;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  eventType: string | null;
  guestCount: number | null;
  venueId: string | null;
  venueName: string | null;
  scheduledAtISO: string;
  dateLabel: string;
  timeLabel: string;
  notes: string | null;
  leadId: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  reminderSentAt: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

const OPEN_STATUSES: SiteVisitStatus[] = ["REQUESTED", "CONFIRMED", "RESCHEDULED"];

export interface GetSiteVisitsFilter {
  status?: SiteVisitStatus;
  scope?: "upcoming" | "past" | "all";
  venueId?: string;
  assignedToId?: string;
  limit?: number;
}

/**
 * List site visits for the internal board. Single-company ERP → staff-wide
 * visibility by design (no per-owner filter). serialize() flattens Dates.
 */
export async function getSiteVisits(
  filter?: GetSiteVisitsFilter
): Promise<Result<SiteVisitRow[]>> {
  const g = await gate("tastings:read");
  if (!g.ok) return { success: false, error: g.error };

  try {
    const limit = Math.min(500, Math.max(1, filter?.limit ?? 200));
    const now = new Date();

    const where: Record<string, unknown> = {};
    if (filter?.status) where.status = filter.status;
    if (filter?.venueId) where.venueId = filter.venueId;
    if (filter?.assignedToId) where.assignedToId = filter.assignedToId;
    if (filter?.scope === "upcoming") where.scheduledAt = { gte: now };
    else if (filter?.scope === "past") where.scheduledAt = { lt: now };

    const rows = await prisma.siteVisitBooking.findMany({
      where,
      select: {
        id: true,
        token: true,
        kind: true,
        status: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        eventType: true,
        guestCount: true,
        venueId: true,
        scheduledAt: true,
        notes: true,
        leadId: true,
        assignedToId: true,
        reminderSentAt: true,
        confirmedAt: true,
        completedAt: true,
        createdAt: true,
        venue: { select: { name: true } },
      },
      orderBy: { scheduledAt: filter?.scope === "past" ? "desc" : "asc" },
      take: limit,
    });

    // Resolve rep display names in one query.
    const repIds = Array.from(
      new Set(rows.map((r) => r.assignedToId).filter((x): x is string => !!x))
    );
    const reps = repIds.length
      ? await prisma.user.findMany({
          where: { id: { in: repIds } },
          select: { id: true, name: true },
        })
      : [];
    const repName = new Map(reps.map((r) => [r.id, r.name] as const));

    const data: SiteVisitRow[] = rows.map((r) => ({
      id: r.id,
      token: r.token,
      kind: r.kind,
      kindLabel: SITE_VISIT_KIND_LABEL[r.kind],
      status: r.status,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      customerEmail: r.customerEmail,
      eventType: r.eventType,
      guestCount: r.guestCount,
      venueId: r.venueId,
      venueName: r.venue?.name ?? null,
      scheduledAtISO: r.scheduledAt.toISOString(),
      dateLabel: formatVisitDateLabel(r.scheduledAt),
      timeLabel: formatVisitTimeLabel(r.scheduledAt),
      notes: r.notes,
      leadId: r.leadId,
      assignedToId: r.assignedToId,
      assignedToName: r.assignedToId ? repName.get(r.assignedToId) ?? null : null,
      reminderSentAt: r.reminderSentAt ? r.reminderSentAt.toISOString() : null,
      confirmedAt: r.confirmedAt ? r.confirmedAt.toISOString() : null,
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }));

    return { success: true, data: serialize(data) };
  } catch (error) {
    console.error("[GET_SITE_VISITS_ERROR]", error);
    return { success: false, error: "Failed to load site visits." };
  }
}

export async function getSiteVisit(id: string): Promise<Result<SiteVisitRow>> {
  const g = await gate("tastings:read");
  if (!g.ok) return { success: false, error: g.error };
  if (!id) return { success: false, error: "Visit not found." };

  const list = await getSiteVisitsById(id);
  if (!list) return { success: false, error: "Visit not found." };
  return { success: true, data: list };
}

async function getSiteVisitsById(id: string): Promise<SiteVisitRow | null> {
  const r = await prisma.siteVisitBooking.findUnique({
    where: { id },
    select: {
      id: true,
      token: true,
      kind: true,
      status: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      eventType: true,
      guestCount: true,
      venueId: true,
      scheduledAt: true,
      notes: true,
      leadId: true,
      assignedToId: true,
      reminderSentAt: true,
      confirmedAt: true,
      completedAt: true,
      createdAt: true,
      venue: { select: { name: true } },
    },
  });
  if (!r) return null;
  let assignedToName: string | null = null;
  if (r.assignedToId) {
    const u = await prisma.user.findUnique({
      where: { id: r.assignedToId },
      select: { name: true },
    });
    assignedToName = u?.name ?? null;
  }
  return {
    id: r.id,
    token: r.token,
    kind: r.kind,
    kindLabel: SITE_VISIT_KIND_LABEL[r.kind],
    status: r.status,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    customerEmail: r.customerEmail,
    eventType: r.eventType,
    guestCount: r.guestCount,
    venueId: r.venueId,
    venueName: r.venue?.name ?? null,
    scheduledAtISO: r.scheduledAt.toISOString(),
    dateLabel: formatVisitDateLabel(r.scheduledAt),
    timeLabel: formatVisitTimeLabel(r.scheduledAt),
    notes: r.notes,
    leadId: r.leadId,
    assignedToId: r.assignedToId,
    assignedToName,
    reminderSentAt: r.reminderSentAt ? r.reminderSentAt.toISOString() : null,
    confirmedAt: r.confirmedAt ? r.confirmedAt.toISOString() : null,
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

/**
 * Confirm a REQUESTED visit → CONFIRMED, stamp confirmedAt, send the prospect a
 * confirmation WhatsApp. tastings:update gated.
 */
export async function confirmSiteVisit(id: string): Promise<Result<{ id: string }>> {
  const g = await gate("tastings:update");
  if (!g.ok) return { success: false, error: g.error };

  try {
    const v = await prisma.siteVisitBooking.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        customerName: true,
        customerPhone: true,
        contactId: true,
        scheduledAt: true,
        venue: { select: { name: true } },
      },
    });
    if (!v) return { success: false, error: "Visit not found." };
    if (v.status !== "REQUESTED" && v.status !== "RESCHEDULED") {
      return { success: false, error: "Only a requested visit can be confirmed." };
    }

    const flipped = await prisma.siteVisitBooking.updateMany({
      where: { id, status: { in: ["REQUESTED", "RESCHEDULED"] } },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });
    if (flipped.count === 0) {
      return { success: false, error: "Visit could not be confirmed." };
    }

    // Customer confirmation WhatsApp (best-effort; carries no internal data).
    const firstName = v.customerName.trim().split(/\s+/)[0] || "there";
    const dateLabel = formatVisitDateLabel(v.scheduledAt);
    const timeLabel = formatVisitTimeLabel(v.scheduledAt);
    const venueName = v.venue?.name || "Veloria Grand";
    const text =
      `Hi ${firstName}, your visit to ${venueName} is confirmed for ${dateLabel} at ` +
      `${timeLabel}. We look forward to welcoming you!`;
    try {
      const result = await sendWhatsApp({
        to: v.customerPhone,
        template: "event_reminder",
        params: { customerName: firstName, eventDate: dateLabel, eventTime: timeLabel },
        message: text,
      });
      if (v.contactId) {
        await prisma.whatsAppMessage
          .create({
            data: {
              direction: "OUTBOUND",
              content: text,
              status: result.success ? "SENT" : "FAILED",
              whatsappId: result.messageId || null,
              contactId: v.contactId,
            },
          })
          .catch(() => {});
      }
    } catch (e) {
      console.error("[CONFIRM_SITE_VISIT_WA_ERROR]", e);
    }

    logActivity({
      action: "UPDATE",
      entityType: "site_visit",
      entityId: id,
      changes: { status: "CONFIRMED" },
      userId: g.user.id,
    });

    revalidatePath("/site-visits");
    return { success: true, data: { id } };
  } catch (error) {
    console.error("[CONFIRM_SITE_VISIT_ERROR]", error);
    return { success: false, error: "Failed to confirm visit." };
  }
}

/**
 * Apply a terminal/transition status (COMPLETED/CANCELLED/NO_SHOW/RESCHEDULED/
 * CONFIRMED) + optional notes. RESCHEDULED accepts a new scheduledAt slot.
 */
export async function updateSiteVisitStatus(
  id: string,
  patch: UpdateSiteVisitStatusInput
): Promise<Result<{ id: string }>> {
  const g = await gate("tastings:update");
  if (!g.ok) return { success: false, error: g.error };

  const parsed = updateSiteVisitStatusSchema.safeParse(patch);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
    return { success: false, error: first || "Invalid update." };
  }
  const p = parsed.data;

  try {
    const v = await prisma.siteVisitBooking.findUnique({
      where: { id },
      select: { id: true, status: true, notes: true },
    });
    if (!v) return { success: false, error: "Visit not found." };

    const data: Record<string, unknown> = { status: p.status };
    data.completedAt = p.status === "COMPLETED" ? new Date() : null;
    if (p.status === "CONFIRMED") data.confirmedAt = new Date();

    if (p.status === "RESCHEDULED" || p.scheduledAt) {
      if (!p.scheduledAt) {
        return { success: false, error: "Pick a new time to reschedule." };
      }
      const when = new Date(p.scheduledAt);
      if (!isValidVisitSlot(when)) {
        return { success: false, error: "Please choose an available visit time." };
      }
      data.scheduledAt = when;
      // A new time invalidates the prior confirmation + reminder one-shot.
      data.confirmedAt = null;
      data.reminderSentAt = null;
    }

    if (p.notes !== undefined && p.notes !== "") {
      // Append to internal notes rather than overwrite the prospect's note.
      data.notes = [v.notes, `[staff] ${p.notes.trim()}`].filter(Boolean).join("\n");
    }

    await prisma.siteVisitBooking.update({ where: { id }, data });

    logActivity({
      action: "UPDATE",
      entityType: "site_visit",
      entityId: id,
      changes: { status: p.status },
      userId: g.user.id,
    });

    revalidatePath("/site-visits");
    return { success: true, data: { id } };
  } catch (error) {
    console.error("[UPDATE_SITE_VISIT_STATUS_ERROR]", error);
    return { success: false, error: "Failed to update visit." };
  }
}

/** Reassign a visit to another host rep; notify the new owner. */
export async function reassignSiteVisit(
  id: string,
  userId: string
): Promise<Result<{ id: string }>> {
  const g = await gate("tastings:update");
  if (!g.ok) return { success: false, error: g.error };
  if (!userId) return { success: false, error: "Pick a team member." };

  try {
    const [v, rep] = await Promise.all([
      prisma.siteVisitBooking.findUnique({
        where: { id },
        select: {
          id: true,
          customerName: true,
          scheduledAt: true,
          kind: true,
          venue: { select: { name: true } },
        },
      }),
      prisma.user.findFirst({
        where: { id: userId, isActive: true },
        select: { id: true, name: true },
      }),
    ]);
    if (!v) return { success: false, error: "Visit not found." };
    if (!rep) return { success: false, error: "That team member isn't available." };

    await prisma.siteVisitBooking.update({
      where: { id },
      data: { assignedToId: rep.id },
    });

    const dateLabel = formatVisitDateLabel(v.scheduledAt);
    const timeLabel = formatVisitTimeLabel(v.scheduledAt);
    await notifyAwait({
      userId: rep.id,
      type: "TASK_ASSIGNED",
      title: `${SITE_VISIT_KIND_LABEL[v.kind]} assigned to you`,
      message: `${v.customerName} — ${dateLabel} at ${timeLabel}${
        v.venue?.name ? ` · ${v.venue.name}` : ""
      }.`,
      actionUrl: "/site-visits",
    }).catch(() => {});

    logActivity({
      action: "UPDATE",
      entityType: "site_visit",
      entityId: id,
      changes: { assignedToId: rep.id },
      userId: g.user.id,
    });

    revalidatePath("/site-visits");
    return { success: true, data: { id } };
  } catch (error) {
    console.error("[REASSIGN_SITE_VISIT_ERROR]", error);
    return { success: false, error: "Failed to reassign visit." };
  }
}

export interface SiteVisitStats {
  total: number;
  requested: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  noShow: number;
  upcoming: number;
  /** completed / (completed + noShow) — show-up rate. */
  showRate: number;
}

export async function getSiteVisitStats(): Promise<Result<SiteVisitStats>> {
  const g = await gate("tastings:read");
  if (!g.ok) return { success: false, error: g.error };

  try {
    const now = new Date();
    const [grouped, upcoming] = await Promise.all([
      prisma.siteVisitBooking.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.siteVisitBooking.count({
        where: { status: { in: OPEN_STATUSES }, scheduledAt: { gte: now } },
      }),
    ]);
    const by = (s: SiteVisitStatus) =>
      grouped.find((row) => row.status === s)?._count._all ?? 0;

    const completed = by("COMPLETED");
    const noShow = by("NO_SHOW");
    const total = grouped.reduce((a, row) => a + row._count._all, 0);
    const showRate =
      completed + noShow > 0 ? Math.round((completed / (completed + noShow)) * 100) : 0;

    return {
      success: true,
      data: {
        total,
        requested: by("REQUESTED"),
        confirmed: by("CONFIRMED"),
        completed,
        cancelled: by("CANCELLED"),
        noShow,
        upcoming,
        showRate,
      },
    };
  } catch (error) {
    console.error("[GET_SITE_VISIT_STATS_ERROR]", error);
    return { success: false, error: "Failed to load stats." };
  }
}

/** Active team members for the reassign picker. */
export async function getSiteVisitAssignees(): Promise<
  Result<{ id: string; name: string | null }[]>
> {
  const g = await gate("tastings:read");
  if (!g.ok) return { success: false, error: g.error };
  try {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ["SUPER_ADMIN", "ADMIN", "SALES_HEAD", "SALES_EXEC", "EVENT_COORDINATOR"] },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return { success: true, data: users };
  } catch (error) {
    console.error("[GET_SITE_VISIT_ASSIGNEES_ERROR]", error);
    return { success: false, error: "Failed to load team." };
  }
}
