"use server";

// ============================================================
// Site-visit management — INTERNAL (gated). Powers /site-visits.
// ------------------------------------------------------------
// Every export gates at the top via auth() + hasPermission. Generalises the BD
// AcqSiteVisit status machine (SCHEDULED/COMPLETED/CANCELLED/NO_SHOW/
// RESCHEDULED) onto SiteVisitBooking. Read = tastings:read; mutations =
// tastings:update. Exports only async functions; revalidates /site-visits.
// ============================================================

import { randomBytes } from "crypto";
import { z } from "zod";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";
import { notifyAwait } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { sendEmail } from "@/lib/email";
import { scheduleCrmTask } from "@/actions/crm-task.actions";
import { revalidatePath } from "next/cache";
import type { SiteVisitStatus, SiteVisitKind } from "@prisma/client";
import {
  updateSiteVisitStatusSchema,
  type UpdateSiteVisitStatusInput,
  normalizeVisitPhone,
  SITE_VISIT_KINDS,
} from "@/schemas/site-visit.schema";
import {
  isValidVisitSlot,
  formatVisitDateLabel,
  formatVisitTimeLabel,
  SITE_VISIT_KIND_LABEL,
  VISIT_MAX_DAYS_AHEAD,
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

// ============================================================
// Lead-scoped scheduling — "Schedule site visit" from /leads/[leadId].
// ------------------------------------------------------------
// Staff-initiated counterpart to the public /visit scheduler. Deliberately does
// NOT reuse lib/site-visit/public-booking.createSiteVisitBooking: that engine
// MINTS A NEW LEAD via captureLeadFromExternal (correct for an anonymous web
// prospect, wrong here — the lead already exists and re-minting would duplicate
// the lead + fire a cold-prospect WhatsApp auto-reply at a known customer).
// We reuse its token shape, IST label helpers and kind labels instead, and
// back-link the EXISTING leadId/contactId onto the booking.
//
// Gated on leads:update (the permission the lead detail page already uses for
// writes) rather than tastings:update — this control lives on the lead page and
// is used by sales reps who may not hold the tastings scope.
//
// Slot policy: unlike the public scheduler, staff are NOT restricted to the
// VISIT_SLOTS catalog (isValidVisitSlot) — they book real appointments at
// arbitrary times with a variable durationMin. We validate future + horizon only.
// ============================================================

/** Unguessable /visit/<token> access token — same shape as public-booking's. */
function newVisitToken(): string {
  return randomBytes(24).toString("base64url");
}

const scheduleLeadVisitSchema = z.object({
  leadId: z.string().trim().min(1, "Lead is required."),
  kind: z.enum(SITE_VISIT_KINDS),
  scheduledAt: z
    .string()
    .min(1, "Pick a date & time.")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Pick a valid date & time."),
  durationMin: z.coerce.number().int().min(15).max(480),
  venueId: z.string().trim().optional().or(z.literal("")),
  customerName: z.string().trim().min(2, "Customer name is required.").max(120),
  customerPhone: z
    .string()
    .trim()
    .min(1, "Customer phone is required.")
    .refine((v) => v.replace(/\D/g, "").length >= 7, "Enter a valid phone number."),
  customerEmail: z.string().trim().email("Enter a valid email.").optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  assignedToId: z.string().trim().min(1, "Pick a host rep."),
  inviteeIds: z.array(z.string().trim().min(1)).max(50).optional(),
});

/** Input for scheduleSiteVisitForLead (types are erasable — safe to export here). */
export type ScheduleLeadVisitInput = z.input<typeof scheduleLeadVisitSchema>;

export interface ScheduleLeadVisitResult {
  id: string;
  token: string;
  /** true when the guest invitation email actually went out. */
  emailSent: boolean;
}

/**
 * Schedule a customer site visit / menu tasting against an existing lead:
 * creates the SiteVisitBooking (minting the /visit/<token> link), tags the
 * internal property team via the SHOW_AROUND CRM-task path (notifies each +
 * lands on their /calendar), and emails the guest an invitation.
 * Every side effect after the row is best-effort — none may fail the booking.
 */
export async function scheduleSiteVisitForLead(
  input: ScheduleLeadVisitInput
): Promise<Result<ScheduleLeadVisitResult>> {
  const g = await gate("leads:update");
  if (!g.ok) return { success: false, error: g.error };

  const parsed = scheduleLeadVisitSchema.safeParse(input);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
    return { success: false, error: first || "Please check the form and try again." };
  }
  const p = parsed.data;

  const scheduledAt = new Date(p.scheduledAt);
  const now = Date.now();
  if (scheduledAt.getTime() <= now) {
    return { success: false, error: "Pick a time in the future." };
  }
  if (scheduledAt.getTime() > now + VISIT_MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) {
    return {
      success: false,
      error: `Visits can only be booked up to ${VISIT_MAX_DAYS_AHEAD} days ahead.`,
    };
  }

  try {
    // (1) The lead must exist (and not be soft-deleted) — never trust a stale id.
    const lead = await prisma.lead.findFirst({
      where: { id: p.leadId, deletedAt: null },
      select: { id: true, title: true, contactId: true, eventType: true, guestCount: true },
    });
    if (!lead) return { success: false, error: "Lead not found." };

    // (2) Resolve venue (optional) — confirm it exists + is active, and grab its
    // name for the guest copy / task description.
    let venueId: string | null = null;
    let venueName: string | null = null;
    if (p.venueId) {
      const venue = await prisma.venue.findFirst({
        where: { id: p.venueId, isActive: true },
        select: { id: true, name: true },
      });
      if (!venue) return { success: false, error: "That venue isn't available." };
      venueId = venue.id;
      venueName = venue.name;
    }

    // (3) Host rep must be a real active user.
    const host = await prisma.user.findFirst({
      where: { id: p.assignedToId, isActive: true },
      select: { id: true, name: true },
    });
    if (!host) return { success: false, error: "That host rep isn't available." };

    const kindLabel = SITE_VISIT_KIND_LABEL[p.kind];
    const dateLabel = formatVisitDateLabel(scheduledAt);
    const timeLabel = formatVisitTimeLabel(scheduledAt);
    const token = newVisitToken();
    const email = p.customerEmail || null;

    // (4) The booking row is the source of truth — back-linked to the EXISTING
    // lead/contact (no lead minting).
    const booking = await prisma.siteVisitBooking.create({
      data: {
        token,
        kind: p.kind,
        status: "REQUESTED",
        customerName: p.customerName,
        customerPhone: normalizeVisitPhone(p.customerPhone),
        customerEmail: email,
        eventType: lead.eventType,
        guestCount: lead.guestCount,
        venueId,
        scheduledAt,
        durationMin: p.durationMin,
        notes: p.notes || null,
        leadId: lead.id,
        contactId: lead.contactId,
        assignedToId: host.id,
      },
      select: { id: true },
    });

    // (5) Tag the internal property team via the existing SHOW_AROUND path: it
    // notifies every invitee AND puts the tour on their /calendar. Host rep is
    // the assignee, so they're notified by the same call.
    const inviteeIds = [...new Set((p.inviteeIds ?? []).filter(Boolean))];
    try {
      const tagged = await scheduleCrmTask({
        leadId: lead.id,
        taskType: "SHOW_AROUND",
        title: `${kindLabel} — ${p.customerName}`,
        dueDate: scheduledAt.toISOString(),
        assigneeId: host.id,
        description: [
          `${kindLabel} scheduled by ${g.user.name ?? "the sales team"}.`,
          venueName ? `Venue: ${venueName}.` : null,
          `Time: ${dateLabel} · ${timeLabel} (IST) · ${p.durationMin} min.`,
          `Guest: ${p.customerName} · ${p.customerPhone}${email ? ` · ${email}` : ""}.`,
          p.notes ? `Notes: ${p.notes}` : null,
          `Manage: /visit/${token}`,
        ]
          .filter(Boolean)
          .join(" "),
        metadata: { inviteeIds, location: venueName },
      });
      // scheduleCrmTask RETURNS a Result rather than throwing — a bare try/catch
      // would swallow a tagging failure silently. Log it; the booking still stands.
      if (!tagged.success) {
        console.error("[SCHEDULE_LEAD_VISIT_TASK_FAILED]", tagged.error);
      }
    } catch (e) {
      console.error("[SCHEDULE_LEAD_VISIT_TASK_ERROR]", e);
    }

    // (6) Guest invitation email — best-effort, never fails the booking.
    let emailSent = false;
    if (email) {
      try {
        const sent = await sendEmail({
          to: email,
          subject: `Your ${kindLabel.toLowerCase()} on ${dateLabel}`,
          html: buildVisitInviteHtml({
            firstName: p.customerName.trim().split(/\s+/)[0] || "there",
            kindLabel,
            venueName,
            dateLabel,
            timeLabel,
            durationMin: p.durationMin,
            token,
          }),
        });
        emailSent = !!sent.success;
      } catch (e) {
        console.error("[SCHEDULE_LEAD_VISIT_EMAIL_ERROR]", e);
      }
    }

    logActivity({
      action: "CREATE",
      entityType: "site_visit",
      entityId: booking.id,
      changes: {
        kind: p.kind,
        scheduledAt: scheduledAt.toISOString(),
        venueId,
        leadId: lead.id,
        assignedToId: host.id,
        inviteeIds,
      },
      userId: g.user.id,
    });

    revalidatePath(`/leads/${lead.id}`);
    revalidatePath("/site-visits");
    revalidatePath("/calendar");
    return { success: true, data: { id: booking.id, token, emailSent } };
  } catch (error) {
    console.error("[SCHEDULE_LEAD_VISIT_ERROR]", error);
    return { success: false, error: "Failed to schedule the site visit." };
  }
}

/** Escape interpolated values so a name/venue can never inject markup. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Guest-facing invitation body. Carries ONLY customer-safe data (venue, IST
 * time, manage link) — never the rep identity, internal notes or lead id.
 */
function buildVisitInviteHtml(args: {
  firstName: string;
  kindLabel: string;
  venueName: string | null;
  dateLabel: string;
  timeLabel: string;
  durationMin: number;
  token: string;
}): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://veloriagrand.com";
  // token is base64url ([A-Za-z0-9_-]) so it is already URL/attribute safe.
  const manageUrl = `${base}/visit/${args.token}`;
  const where = esc(args.venueName || "Veloria Grand");
  const kind = esc(args.kindLabel.toLowerCase());
  return `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
      <h2 style="margin:0 0 12px;font-size:20px;color:#111827">Your ${kind} is booked</h2>
      <p style="margin:0 0 16px;line-height:1.6">
        Hi ${esc(args.firstName)}, we've reserved time for your ${kind} at ${where}.
        Here are the details:
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;background:#f9fafb;border-radius:8px">
        <tr><td style="padding:10px 14px;color:#6b7280;font-size:13px">Venue</td><td style="padding:10px 14px;font-weight:600">${where}</td></tr>
        <tr><td style="padding:10px 14px;color:#6b7280;font-size:13px">Date</td><td style="padding:10px 14px;font-weight:600">${esc(args.dateLabel)}</td></tr>
        <tr><td style="padding:10px 14px;color:#6b7280;font-size:13px">Time</td><td style="padding:10px 14px;font-weight:600">${esc(args.timeLabel)} IST (${args.durationMin} min)</td></tr>
      </table>
      <p style="margin:0 0 16px;line-height:1.6">
        Please confirm so our team can be ready for you. You can also reschedule or cancel from the same link.
      </p>
      <p style="margin:0 0 24px">
        <a href="${manageUrl}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:11px 22px;border-radius:6px;font-weight:600">Confirm or reschedule</a>
      </p>
      <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6">
        If the button doesn't work, paste this into your browser:<br />
        <a href="${manageUrl}" style="color:#6b7280">${manageUrl}</a>
      </p>
    </div>
  `;
}

export interface LeadSiteVisitRow {
  id: string;
  token: string;
  kindLabel: string;
  status: SiteVisitStatus;
  venueName: string | null;
  scheduledAtISO: string;
  dateLabel: string;
  timeLabel: string;
  durationMin: number;
  assignedToName: string | null;
  customerEmail: string | null;
  notes: string | null;
}

/** Site visits booked against a lead, for the lead detail panel. */
export async function getLeadSiteVisits(
  leadId: string
): Promise<Result<LeadSiteVisitRow[]>> {
  const g = await gate("leads:read");
  if (!g.ok) return { success: false, error: g.error };
  if (!leadId) return { success: false, error: "Lead not found." };

  try {
    const rows = await prisma.siteVisitBooking.findMany({
      where: { leadId },
      select: {
        id: true,
        token: true,
        kind: true,
        status: true,
        scheduledAt: true,
        durationMin: true,
        assignedToId: true,
        customerEmail: true,
        notes: true,
        venue: { select: { name: true } },
      },
      orderBy: { scheduledAt: "desc" },
      take: 50,
    });

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

    const data: LeadSiteVisitRow[] = rows.map((r) => ({
      id: r.id,
      token: r.token,
      kindLabel: SITE_VISIT_KIND_LABEL[r.kind],
      status: r.status,
      venueName: r.venue?.name ?? null,
      scheduledAtISO: r.scheduledAt.toISOString(),
      dateLabel: formatVisitDateLabel(r.scheduledAt),
      timeLabel: formatVisitTimeLabel(r.scheduledAt),
      durationMin: r.durationMin,
      assignedToName: r.assignedToId ? repName.get(r.assignedToId) ?? null : null,
      customerEmail: r.customerEmail,
      notes: r.notes,
    }));

    return { success: true, data: serialize(data) };
  } catch (error) {
    console.error("[GET_LEAD_SITE_VISITS_ERROR]", error);
    return { success: false, error: "Failed to load site visits." };
  }
}

export interface LeadVisitVenueOption {
  id: string;
  name: string;
}

/**
 * Bookable venues for the lead-page scheduler. Gated on leads:read so a sales
 * rep can open the dialog without the tastings scope.
 */
export async function getLeadVisitVenues(): Promise<Result<LeadVisitVenueOption[]>> {
  const g = await gate("leads:read");
  if (!g.ok) return { success: false, error: g.error };
  try {
    const venues = await prisma.venue.findMany({
      where: { isActive: true, parentVenueId: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return { success: true, data: venues };
  } catch (error) {
    console.error("[GET_LEAD_VISIT_VENUES_ERROR]", error);
    return { success: false, error: "Failed to load venues." };
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
