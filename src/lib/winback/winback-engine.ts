// ============================================================
// Win-back engine — owned-demand recovery sweeps. Three best-effort,
// never-throwing scans (mirrors lead-pipeline.ts), each batched at TAKE 200,
// each idempotently tracked by one WinbackTarget row per subject:
//
//   (a) runAbandonedQuoteWinback()  — QuoteShareLink viewed but unpaid N days
//   (b) runLostLeadRevivalWinback() — Lead status=LOST, per-reason cool-off
//   (c) runEventProximityWinback()  — open enquiry whose eventDate is near-term
//
// Each recovers a subject by enrolling it into the configured win-back Cadence
// (via the unauthed enrollEntityIntoCadence helper) or, when no cadence is
// configured, firing a direct approved-template WhatsApp. No money mutation —
// strictly read + enroll/notify.
//
// Plain library (NOT "use server"): import-only by the cron sub-routes.
// ============================================================

import { Prisma, type WinbackKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyAwait } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { enrollEntityIntoCadence } from "@/lib/winback/enroll-into-cadence";
import {
  resolveWinbackCadence,
  coolOffDaysForLostReason,
  WINBACK_FALLBACK_TEMPLATE,
  N_DAYS_ABANDONED,
  PROXIMITY_WINDOW_MIN_DAYS,
  PROXIMITY_WINDOW_MAX_DAYS,
} from "@/lib/winback/winback-config";

const BATCH = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface WinbackRunResult {
  kind: WinbackKind;
  scanned: number;
  enrolled: number;
  fired: number;
  skipped: number;
  errors: number;
}

function emptyResult(kind: WinbackKind): WinbackRunResult {
  return { kind, scanned: 0, enrolled: 0, fired: 0, skipped: 0, errors: 0 };
}

// ------------------------------------------------------------
// Idempotency — find-or-create the WinbackTarget for a subject. The approved
// delta gives only @@index (not @@unique) on (kind, *Id), so we do an explicit
// findFirst-then-create. A rare concurrent dup row is benign because the enroll
// itself is guarded by CadenceEnrollment @@unique(cadenceId, entityId).
// ------------------------------------------------------------
interface SubjectKey {
  kind: WinbackKind;
  leadId?: string | null;
  contactId?: string | null;
  shareLinkId?: string | null;
}

async function findOrCreateTarget(
  key: SubjectKey,
  extra: {
    lostReason?: string | null;
    eventDate?: Date | null;
    coolOffUntil?: Date | null;
  }
): Promise<{ id: string; status: string; isNew: boolean } | null> {
  try {
    const where: Prisma.WinbackTargetWhereInput = { kind: key.kind };
    if (key.shareLinkId) where.shareLinkId = key.shareLinkId;
    else if (key.leadId) where.leadId = key.leadId;
    else if (key.contactId) where.contactId = key.contactId;
    else return null;

    const existing = await prisma.winbackTarget.findFirst({
      where,
      select: { id: true, status: true },
    });
    if (existing) {
      return { id: existing.id, status: existing.status, isNew: false };
    }

    const created = await prisma.winbackTarget.create({
      data: {
        kind: key.kind,
        status: "PENDING",
        leadId: key.leadId ?? null,
        contactId: key.contactId ?? null,
        shareLinkId: key.shareLinkId ?? null,
        lostReason: extra.lostReason ?? null,
        eventDate: extra.eventDate ?? null,
        coolOffUntil: extra.coolOffUntil ?? null,
      },
      select: { id: true, status: true },
    });
    return { id: created.id, status: created.status, isNew: true };
  } catch (e) {
    console.error("[winback findOrCreateTarget] error:", e);
    return null;
  }
}

// ------------------------------------------------------------
// Recovery dispatch — enroll into the configured cadence, else direct-fire an
// approved WhatsApp template. Persists the outcome on the WinbackTarget and
// alerts the assigned rep. Awaits everything (no fire-and-forget) so the
// serverless freeze after the response can't drop the writes.
// ------------------------------------------------------------
interface DispatchArgs {
  kind: WinbackKind;
  targetId: string;
  leadId?: string | null;
  contactId?: string | null;
  assignedToId?: string | null;
  phone?: string | null;
  templateParams: Record<string, string>;
  alertTitle: string;
  alertMessage: string;
  actionUrl: string;
}

type DispatchOutcome = "enrolled" | "fired" | "skipped" | "error";

async function dispatchRecovery(args: DispatchArgs): Promise<DispatchOutcome> {
  const now = new Date();
  try {
    const cadence = await resolveWinbackCadence(args.kind);

    if (cadence && args.leadId) {
      const { enrollmentId, alreadyEnrolled } = await enrollEntityIntoCadence(
        cadence.id,
        args.leadId,
        "LEAD",
        cadence.firstStepDelayMs
      );
      if (!enrollmentId) {
        await prisma.winbackTarget.update({
          where: { id: args.targetId },
          data: { attempts: { increment: 1 }, lastAttemptAt: now },
        });
        return "error";
      }
      await prisma.winbackTarget.update({
        where: { id: args.targetId },
        data: {
          status: "ENROLLED",
          cadenceId: cadence.id,
          enrollmentId,
          attempts: { increment: 1 },
          lastAttemptAt: now,
        },
      });
      if (!alreadyEnrolled) {
        await maybeAlertRep(args, now);
        logActivity({
          userId: "system",
          action: "WINBACK_ENROLL",
          entityType: "winback_target",
          entityId: args.targetId,
          changes: { kind: args.kind, cadenceId: cadence.id, leadId: args.leadId },
        });
      }
      return "enrolled";
    }

    // No cadence configured for this kind → direct WhatsApp fallback.
    const template = WINBACK_FALLBACK_TEMPLATE[args.kind];
    if (!template || !args.phone) {
      await prisma.winbackTarget.update({
        where: { id: args.targetId },
        data: { status: "SUPPRESSED", attempts: { increment: 1 }, lastAttemptAt: now },
      });
      return "skipped";
    }

    const res = await sendWhatsApp({
      to: args.phone,
      template,
      params: args.templateParams,
    });

    if (res.success) {
      await prisma.winbackTarget.update({
        where: { id: args.targetId },
        data: {
          status: "CONTACTED",
          whatsappMessageId: res.messageId ?? null,
          attempts: { increment: 1 },
          lastAttemptAt: now,
        },
      });
      await maybeAlertRep(args, now);
      logActivity({
        userId: "system",
        action: "WINBACK_DIRECT_FIRE",
        entityType: "winback_target",
        entityId: args.targetId,
        changes: { kind: args.kind, template, contactId: args.contactId },
      });
      return "fired";
    }

    // Send failed (best-effort, no throw): record the attempt and move on.
    await prisma.winbackTarget.update({
      where: { id: args.targetId },
      data: { attempts: { increment: 1 }, lastAttemptAt: now },
    });
    return "error";
  } catch (e) {
    console.error("[winback dispatchRecovery] error:", e);
    try {
      await prisma.winbackTarget.update({
        where: { id: args.targetId },
        data: { attempts: { increment: 1 }, lastAttemptAt: now },
      });
    } catch {
      /* ignore */
    }
    return "error";
  }
}

async function maybeAlertRep(args: DispatchArgs, _now: Date): Promise<void> {
  if (!args.assignedToId) return;
  await notifyAwait({
    userId: args.assignedToId,
    title: args.alertTitle,
    message: args.alertMessage,
    type: "SYSTEM",
    actionUrl: args.actionUrl,
  });
}

function contactName(c?: { firstName?: string | null; lastName?: string | null } | null): string {
  if (!c) return "there";
  return `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "there";
}

function inrLabel(amount: Prisma.Decimal | number | string | null | undefined): string {
  const n = amount == null ? 0 : Number(amount);
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

// ============================================================
// (a) Abandoned-quote recovery
// ============================================================
// QuoteShareLink rows viewed (lastViewedAt set) at least N days ago but never
// paid (no settled invoice). silentNudgeFiredAt is the one-shot dedupe flag so
// a daily rerun never re-nudges the same link.
// ============================================================
export async function runAbandonedQuoteWinback(): Promise<WinbackRunResult> {
  const kind: WinbackKind = "ABANDONED_QUOTE";
  const result = emptyResult(kind);
  const cutoff = new Date(Date.now() - N_DAYS_ABANDONED * DAY_MS);

  try {
    const links = await prisma.quoteShareLink.findMany({
      where: {
        status: "ACTIVE",
        silentNudgeFiredAt: null,
        lastViewedAt: { not: null, lt: cutoff },
        contactId: { not: null },
      },
      select: {
        id: true,
        leadId: true,
        contactId: true,
        clientName: true,
        clientPhone: true,
        occasion: true,
        grandTotal: true,
        payInvoiceId: true,
      },
      orderBy: { lastViewedAt: "asc" },
      take: BATCH,
    });
    result.scanned = links.length;

    for (const link of links) {
      try {
        // Paid detection: treat null / "__pending__" payInvoiceId as unpaid;
        // for a real invoice ref, only skip when it's actually settled.
        if (link.payInvoiceId && link.payInvoiceId !== "__pending__") {
          const invoice = await prisma.invoice.findUnique({
            where: { id: link.payInvoiceId },
            select: { status: true, balanceDue: true },
          });
          if (
            invoice &&
            (invoice.status === "PAID" ||
              invoice.status === "PARTIALLY_PAID" ||
              Number(invoice.balanceDue) <= 0)
          ) {
            // Customer already paid (at least an advance) — never nudge them.
            await markLinkNudged(link.id);
            result.skipped++;
            continue;
          }
        }

        if (!link.contactId) {
          result.skipped++;
          continue;
        }

        const contact = await prisma.contact.findUnique({
          where: { id: link.contactId },
          select: { firstName: true, lastName: true, phone: true, deletedAt: true },
        });
        if (!contact || contact.deletedAt) {
          await markLinkNudged(link.id);
          result.skipped++;
          continue;
        }

        const target = await findOrCreateTarget(
          { kind, leadId: link.leadId, contactId: link.contactId, shareLinkId: link.id },
          {}
        );
        if (!target) {
          result.errors++;
          continue;
        }
        if (!target.isNew && target.status !== "PENDING") {
          await markLinkNudged(link.id);
          result.skipped++;
          continue;
        }

        const assignedToId = link.leadId
          ? (await prisma.lead.findUnique({ where: { id: link.leadId }, select: { assignedToId: true } }))?.assignedToId ?? null
          : null;

        const name = link.clientName || contactName(contact);
        const outcome = await dispatchRecovery({
          kind,
          targetId: target.id,
          leadId: link.leadId,
          contactId: link.contactId,
          assignedToId,
          phone: link.clientPhone || contact.phone,
          templateParams: {
            customerName: name,
            occasion: link.occasion || "your event",
            grandTotal: inrLabel(link.grandTotal),
          },
          alertTitle: "💸 Abandoned quote — re-engage",
          alertMessage: `${name} viewed their quote (${inrLabel(link.grandTotal)}) but hasn't paid. Win-back started.`,
          actionUrl: link.leadId ? `/leads/${link.leadId}` : `/quotations`,
        });

        // One-shot: stamp silentNudgeFiredAt so this link is never re-scanned.
        await markLinkNudged(link.id);
        tally(result, outcome);
      } catch (e) {
        console.error("[runAbandonedQuoteWinback] row error:", e);
        result.errors++;
      }
    }
  } catch (e) {
    console.error("[runAbandonedQuoteWinback] error:", e);
  }
  return result;
}

async function markLinkNudged(id: string): Promise<void> {
  try {
    await prisma.quoteShareLink.update({
      where: { id },
      data: { silentNudgeFiredAt: new Date() },
    });
  } catch (e) {
    console.error("[markLinkNudged] error:", e);
  }
}

// ============================================================
// (b) Lost-lead taxonomy revival
// ============================================================
// Lead status=LOST whose per-reason cool-off has elapsed (measured from
// updatedAt as a lostAt proxy; coolOffUntil is frozen on the WinbackTarget at
// first scan). One target per lead; coolingEnrolledAt is left to the cooling
// feature — here we dedupe purely on the WinbackTarget.
// ============================================================
export async function runLostLeadRevivalWinback(): Promise<WinbackRunResult> {
  const kind: WinbackKind = "LOST_LEAD_REVIVAL";
  const result = emptyResult(kind);
  const now = new Date();

  try {
    const leads = await prisma.lead.findMany({
      where: {
        status: "LOST",
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        lostReason: true,
        updatedAt: true,
        assignedToId: true,
        eventType: true,
        contactId: true,
        contact: { select: { firstName: true, lastName: true, phone: true, deletedAt: true } },
      },
      orderBy: { updatedAt: "asc" },
      take: BATCH,
    });
    result.scanned = leads.length;

    for (const lead of leads) {
      try {
        if (!lead.contact || lead.contact.deletedAt) {
          result.skipped++;
          continue;
        }

        const coolOffDays = coolOffDaysForLostReason(lead.lostReason);
        const eligibleAt = new Date(lead.updatedAt.getTime() + coolOffDays * DAY_MS);

        // Existing target? Respect its frozen coolOffUntil; otherwise compute.
        const target = await findOrCreateTarget(
          { kind, leadId: lead.id, contactId: lead.contactId },
          { lostReason: lead.lostReason, coolOffUntil: eligibleAt }
        );
        if (!target) {
          result.errors++;
          continue;
        }
        if (!target.isNew && target.status !== "PENDING") {
          result.skipped++;
          continue;
        }

        // Re-read the (possibly frozen) coolOffUntil for the eligibility gate.
        const row = await prisma.winbackTarget.findUnique({
          where: { id: target.id },
          select: { coolOffUntil: true },
        });
        const gate = row?.coolOffUntil ?? eligibleAt;
        if (gate > now) {
          result.skipped++;
          continue;
        }

        const name = contactName(lead.contact);
        const outcome = await dispatchRecovery({
          kind,
          targetId: target.id,
          leadId: lead.id,
          contactId: lead.contactId,
          assignedToId: lead.assignedToId,
          phone: lead.contact.phone,
          templateParams: {
            customerName: name,
            occasion: lead.eventType || "your event",
          },
          alertTitle: "🔁 Lost lead revival",
          alertMessage: `Reviving ${name} (lost: ${lead.lostReason || "unspecified"}). Win-back started.`,
          actionUrl: `/leads/${lead.id}`,
        });
        tally(result, outcome);
      } catch (e) {
        console.error("[runLostLeadRevivalWinback] row error:", e);
        result.errors++;
      }
    }
  } catch (e) {
    console.error("[runLostLeadRevivalWinback] error:", e);
  }
  return result;
}

// ============================================================
// (c) Event-date-proximity win-back
// ============================================================
// Old open enquiries (status NOT IN WON/LOST) whose eventDate now falls inside
// the near-term window [MIN..MAX] days out. Excludes leads already converted to
// a live booking (handled by status filter + booking check) so we never message
// someone who already paid.
// ============================================================
export async function runEventProximityWinback(): Promise<WinbackRunResult> {
  const kind: WinbackKind = "EVENT_DATE_PROXIMITY";
  const result = emptyResult(kind);
  const now = new Date();
  const windowStart = new Date(now.getTime() + PROXIMITY_WINDOW_MIN_DAYS * DAY_MS);
  const windowEnd = new Date(now.getTime() + PROXIMITY_WINDOW_MAX_DAYS * DAY_MS);

  try {
    const leads = await prisma.lead.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ["WON", "LOST"] },
        eventDate: { gte: windowStart, lte: windowEnd },
      },
      select: {
        id: true,
        title: true,
        eventDate: true,
        eventType: true,
        assignedToId: true,
        contactId: true,
        contact: { select: { firstName: true, lastName: true, phone: true, deletedAt: true } },
        deal: { select: { booking: { select: { id: true, status: true } } } },
      },
      orderBy: { eventDate: "asc" },
      take: BATCH,
    });
    result.scanned = leads.length;

    for (const lead of leads) {
      try {
        if (!lead.contact || lead.contact.deletedAt) {
          result.skipped++;
          continue;
        }
        // Already has a live (non-cancelled) booking → they're effectively won.
        const booking = lead.deal?.booking;
        if (booking && booking.status !== "CANCELLED") {
          result.skipped++;
          continue;
        }

        const target = await findOrCreateTarget(
          { kind, leadId: lead.id, contactId: lead.contactId },
          { eventDate: lead.eventDate }
        );
        if (!target) {
          result.errors++;
          continue;
        }
        if (!target.isNew && target.status !== "PENDING") {
          result.skipped++;
          continue;
        }

        const name = contactName(lead.contact);
        const eventDateLabel = lead.eventDate
          ? lead.eventDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : "your event date";
        const outcome = await dispatchRecovery({
          kind,
          targetId: target.id,
          leadId: lead.id,
          contactId: lead.contactId,
          assignedToId: lead.assignedToId,
          phone: lead.contact.phone,
          templateParams: {
            customerName: name,
            eventDate: eventDateLabel,
          },
          alertTitle: "📅 Event date approaching",
          alertMessage: `${name}'s event (${eventDateLabel}) is near and still unbooked. Win-back started.`,
          actionUrl: `/leads/${lead.id}`,
        });
        tally(result, outcome);
      } catch (e) {
        console.error("[runEventProximityWinback] row error:", e);
        result.errors++;
      }
    }
  } catch (e) {
    console.error("[runEventProximityWinback] error:", e);
  }
  return result;
}

function tally(result: WinbackRunResult, outcome: DispatchOutcome): void {
  switch (outcome) {
    case "enrolled":
      result.enrolled++;
      break;
    case "fired":
      result.fired++;
      break;
    case "skipped":
      result.skipped++;
      break;
    case "error":
      result.errors++;
      break;
  }
}
