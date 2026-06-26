// ============================================================
// Site-visit public booking engine — plain library (NOT "use server").
// ------------------------------------------------------------
// Callable from the public action AND from cron. Owns the full create flow for
// a self-serve site-visit / menu-tasting:
//   1. mint an unguessable token (randomBytes base64url, like newToken)
//   2. validate the slot against the catalog (slots.ts)
//   3. create the SiteVisitBooking row (status REQUESTED)
//   4. mint a HIGH-SCORE Lead via captureLeadFromExternal (runs runLeadIntake:
//      instant WhatsApp auto-reply + cadence + speed-to-lead SLA clock)
//   5. resolve/assign a host rep (assignment rules → round-robin)
//   6. create the internal calendar Task (assigneeId=host, dueDate=scheduledAt)
//   7. send a confirmation WhatsApp + notify the host rep
//
// Every side effect is best-effort / never-throws: a failed Task or WhatsApp
// must never abort a valid booking (mirrors lead-capture's try/per-step style).
// The booking row is the source of truth; leadId/contactId/assignedToId are
// back-linked only after each step succeeds (no orphaned refs).
// ============================================================

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { notifyAwait } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { captureLeadFromExternal, getSystemUserId } from "@/lib/lead-capture";
import { evaluateAssignmentRules } from "@/actions/assignment-rule.actions";
import type { SiteVisitKind } from "@prisma/client";
import {
  SITE_VISIT_DEFAULT_DURATION_MIN,
  SITE_VISIT_KIND_LABEL,
  isValidVisitSlot,
  formatVisitDateLabel,
  formatVisitTimeLabel,
} from "@/lib/site-visit/slots";

type Result<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Lead score floor a booked visit/tasting must clear. A prospect who picks a
 * date + drives to the venue is a strong buying signal; the default scorer is
 * budget-driven and would underscore a visit with no quoted value, so we lift
 * the minted lead's score to this floor (see spec HIGH-SCORE risk).
 */
const SITE_VISIT_LEAD_SCORE_FLOOR = 80;
const MENU_TASTING_LEAD_SCORE_FLOOR = 88; // tasting is even later-funnel

export interface CreateSiteVisitInput {
  name: string;
  phone: string; // already-normalized digits preferred
  email?: string | null;
  kind: SiteVisitKind;
  scheduledAt: Date;
  venueId?: string | null;
  eventType?: string | null;
  guestCount?: number | null;
  notes?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
}

export interface CreateSiteVisitResult {
  token: string;
  bookingId: string;
}

/** Unguessable /visit/<token> access token — same shape as newToken(). */
function newToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Resolve a host rep for the visit. Prefer the assignment-rule engine (so the
 * visit and the lead land with the same owner); fall back to a round-robin over
 * active sales-capable users; finally the system admin. Never throws.
 */
async function resolveHostRep(input: CreateSiteVisitInput): Promise<string | null> {
  try {
    const assigned = await evaluateAssignmentRules({
      source: "website",
      eventType: input.eventType ?? undefined,
    });
    if (assigned) return assigned;
  } catch {
    // assignment rules optional
  }

  // Round-robin fallback: the active user with the fewest open visit Tasks.
  try {
    const reps = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ["SUPER_ADMIN", "ADMIN", "SALES_HEAD", "SALES_EXEC", "EVENT_COORDINATOR"] },
      },
      select: { id: true },
    });
    if (reps.length > 0) {
      const counts = await Promise.all(
        reps.map(async (r) => ({
          id: r.id,
          open: await prisma.task.count({
            where: { assigneeId: r.id, status: { in: ["TODO", "IN_PROGRESS"] } },
          }),
        }))
      );
      counts.sort((a, b) => a.open - b.open);
      return counts[0]?.id ?? null;
    }
  } catch {
    // fall through
  }

  return (await getSystemUserId()) || null;
}

/**
 * Create a site-visit / menu-tasting booking + minted lead + calendar entry.
 * Best-effort on every side effect; the SiteVisitBooking row is authoritative.
 */
export async function createSiteVisitBooking(
  input: CreateSiteVisitInput
): Promise<Result<CreateSiteVisitResult>> {
  try {
    // (1) Slot validity — the single guard for every write path.
    if (!isValidVisitSlot(input.scheduledAt)) {
      return { success: false, error: "Please choose an available visit time." };
    }

    const name = input.name.trim();
    const phone = input.phone.trim();
    const email = input.email?.trim() || null;
    const kindLabel = SITE_VISIT_KIND_LABEL[input.kind];

    // (2) Resolve venue (optional) — confirm it exists + is active, never trust
    // a stale/invalid id, and grab its name for the confirmation copy.
    let venueId: string | null = null;
    let venueName: string | null = null;
    if (input.venueId) {
      const venue = await prisma.venue.findFirst({
        where: { id: input.venueId, isActive: true },
        select: { id: true, name: true },
      });
      if (venue) {
        venueId = venue.id;
        venueName = venue.name;
      }
    }

    // (3) Resolve a host rep before the row so the calendar Task + notify land.
    const hostRepId = await resolveHostRep(input);

    // (4) Create the booking row (status REQUESTED), unguessable token.
    const token = newToken();
    const dateLabel = formatVisitDateLabel(input.scheduledAt);
    const timeLabel = formatVisitTimeLabel(input.scheduledAt);

    const booking = await prisma.siteVisitBooking.create({
      data: {
        token,
        kind: input.kind,
        status: "REQUESTED",
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        eventType: input.eventType?.trim() || null,
        guestCount: input.guestCount ?? null,
        venueId,
        scheduledAt: input.scheduledAt,
        durationMin: SITE_VISIT_DEFAULT_DURATION_MIN,
        notes: input.notes?.trim() || null,
        assignedToId: hostRepId,
        utmSource: input.utmSource?.trim() || null,
        utmMedium: input.utmMedium?.trim() || null,
        utmCampaign: input.utmCampaign?.trim() || null,
      },
      select: { id: true },
    });

    // (5) Mint the HIGH-SCORE lead (runs runLeadIntake internally: instant
    // WhatsApp auto-reply + cadence enrolment + speed-to-lead SLA clock).
    // Non-fatal: a lead failure must not collapse a valid visit booking.
    let leadId: string | null = null;
    let contactId: string | null = null;
    try {
      const lead = await captureLeadFromExternal({
        name,
        email: email || undefined,
        phone,
        source: "website",
        message: `Requested ${kindLabel.toLowerCase()} on ${dateLabel} at ${timeLabel}${
          venueName ? ` · ${venueName}` : ""
        }.${input.notes ? ` Notes: ${input.notes.trim()}` : ""}`,
        eventType: input.eventType?.trim() || undefined,
        guestCount: input.guestCount ?? undefined,
        venueId: venueId || undefined,
        attribution: input.utmSource
          ? {
              source: input.utmSource,
              medium: input.utmMedium || undefined,
              campaign: input.utmCampaign || undefined,
            }
          : undefined,
        customFields: {
          siteVisitToken: token,
          siteVisitKind: input.kind,
          utmSource: input.utmSource || null,
          utmMedium: input.utmMedium || null,
          utmCampaign: input.utmCampaign || null,
        },
      });
      if (lead && (lead as { success?: boolean }).success) {
        leadId = (lead as { leadId?: string }).leadId ?? null;
        contactId = (lead as { contactId?: string }).contactId ?? null;

        // Lift the minted lead to a HIGH-SCORE floor — a booked visit/tasting is
        // a strong buying signal the budget-driven scorer underweights.
        if (leadId) {
          const floor =
            input.kind === "MENU_TASTING"
              ? MENU_TASTING_LEAD_SCORE_FLOOR
              : SITE_VISIT_LEAD_SCORE_FLOOR;
          await prisma.lead
            .updateMany({
              where: { id: leadId, score: { lt: floor } },
              data: { score: floor },
            })
            .catch(() => {});
        }

        // Back-link the lead/contact onto the booking only after success.
        await prisma.siteVisitBooking
          .update({ where: { id: booking.id }, data: { leadId, contactId } })
          .catch(() => {});
      }
    } catch (e) {
      console.error("[SITE_VISIT_LEAD_ERROR]", e);
    }

    // (6) Internal calendar entry — a Task for the host rep at the visit time.
    if (hostRepId) {
      try {
        const creatorId = (await getSystemUserId()) || hostRepId;
        await prisma.task.create({
          data: {
            title: `${kindLabel} — ${name}`,
            description: [
              `${kindLabel} requested via the online scheduler.`,
              venueName ? `Venue: ${venueName}.` : null,
              `Time: ${dateLabel} · ${timeLabel}.`,
              `Contact: ${phone}${email ? ` · ${email}` : ""}.`,
              input.notes ? `Notes: ${input.notes.trim()}` : null,
              `Manage: /visit/${token}`,
            ]
              .filter(Boolean)
              .join(" "),
            status: "TODO",
            priority: "HIGH",
            dueDate: input.scheduledAt,
            assigneeId: hostRepId,
            creatorId,
          },
        });
      } catch (e) {
        console.error("[SITE_VISIT_TASK_ERROR]", e);
      }

      // (7) Notify the host rep (awaited for serverless safety).
      try {
        await notifyAwait({
          userId: hostRepId,
          type: "TASK_ASSIGNED",
          title: `New ${kindLabel.toLowerCase()} request`,
          message: `${name} requested a ${kindLabel.toLowerCase()} on ${dateLabel} at ${timeLabel}${
            venueName ? ` · ${venueName}` : ""
          }.`,
          actionUrl: "/site-visits",
        });
      } catch (e) {
        console.error("[SITE_VISIT_NOTIFY_ERROR]", e);
      }
    }

    // (8) Confirmation WhatsApp to the prospect + inbox mirror (best-effort).
    await sendVisitConfirmation({
      phone,
      name,
      dateLabel,
      timeLabel,
      venueName,
      contactId,
    }).catch((e) => console.error("[SITE_VISIT_CONFIRM_ERROR]", e));

    // Audit trail.
    try {
      logActivity({
        action: "CREATE",
        entityType: "site_visit",
        entityId: booking.id,
        changes: { kind: input.kind, scheduledAt: input.scheduledAt.toISOString(), venueId },
        userId: hostRepId || "system",
      });
    } catch {
      // audit optional
    }

    return { success: true, data: { token, bookingId: booking.id } };
  } catch (error) {
    console.error("[CREATE_SITE_VISIT_ERROR]", error);
    return { success: false, error: "We couldn't book your visit. Please try again." };
  }
}

/**
 * Customer-facing confirmation WhatsApp. Reuses the Meta-approved
 * `event_reminder` template (params: customerName, eventDate, eventTime) so no
 * new template registration is required; falls back to a plain text body when
 * the template send isn't available. Mirrors to WhatsAppMessage when we know
 * the contact. Carries NO internal notes / rep identity (see PII risk).
 */
async function sendVisitConfirmation(args: {
  phone: string;
  name: string;
  dateLabel: string;
  timeLabel: string;
  venueName: string | null;
  contactId: string | null;
}): Promise<void> {
  const firstName = args.name.split(/\s+/)[0] || "there";
  const text =
    `Hi ${firstName}, your visit to ${args.venueName || "Veloria Grand"} is requested for ` +
    `${args.dateLabel} at ${args.timeLabel}. Our team will confirm shortly. ` +
    `Reply here if you need to change anything.`;

  const result = await sendWhatsApp({
    to: args.phone,
    template: "event_reminder",
    params: {
      customerName: firstName,
      eventDate: args.dateLabel,
      eventTime: args.timeLabel,
    },
    message: text,
  });

  if (args.contactId) {
    await prisma.whatsAppMessage
      .create({
        data: {
          direction: "OUTBOUND",
          content: text,
          status: result.success ? "SENT" : "FAILED",
          whatsappId: result.messageId || null,
          contactId: args.contactId,
        },
      })
      .catch(() => {});
  }
}
