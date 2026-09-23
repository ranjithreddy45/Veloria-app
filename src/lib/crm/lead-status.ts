// ============================================================
// One place that decides whether a lead may change status.
// ------------------------------------------------------------
// The guards for this were copy-pasted across nine write paths and had already
// drifted apart: the single-lead dropdown checks owner + junk-quality, the bulk
// action checks owner only, the pipeline drag checks owner only, and macros,
// workflows, deal-to-booking and CSV import check nothing at all. A rule is
// only as strong as its weakest call site, and Qualified is about to start
// costing money — it is what teaches Google Ads what to bid on.
//
// So: every path calls guardLeadStatusChange() with whatever Prisma client it
// already has (transaction or not), gets back either a refusal with a sentence
// a human can act on, or the timestamps to merge into its own update.
// ============================================================

import type { Prisma, PrismaClient } from "@prisma/client";

import {
  stampsForStatus,
  validateLeadStatusChange,
} from "@/lib/marketing/lead-status-rules";

/** Any Prisma client — the base one or a transaction. */
type Db = PrismaClient | Prisma.TransactionClient;

export type LeadStatusGuard =
  | { ok: true; stamps: { qualifiedAt?: Date; wonAt?: Date } }
  | { ok: false; error: string };

/**
 * May this lead become `nextStatus`, and what timestamps go with it?
 *
 * Reads the lead inside the caller's own client, so a transaction sees the row
 * it is about to write rather than a stale copy read before it started.
 */
export async function guardLeadStatusChange(
  db: Db,
  leadId: string,
  nextStatus: string,
  now: Date = new Date()
): Promise<LeadStatusGuard> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: {
      eventDate: true,
      guestCount: true,
      eventType: true,
      locationConfirmed: true,
      bookingValue: true,
      qualifiedAt: true,
      wonAt: true,
    },
  });
  if (!lead) return { ok: false, error: "Lead not found." };

  const ruled = validateLeadStatusChange(nextStatus, {
    eventDate: lead.eventDate,
    guestCount: lead.guestCount,
    eventType: lead.eventType,
    locationConfirmed: lead.locationConfirmed,
    bookingValue: lead.bookingValue,
  });
  if (!ruled.ok) return { ok: false, error: ruled.error };

  return {
    ok: true,
    stamps: stampsForStatus(
      nextStatus,
      { qualifiedAt: lead.qualifiedAt, wonAt: lead.wonAt },
      now
    ),
  };
}

/**
 * The same judgement for a batch, in one round trip.
 *
 * Bulk actions cannot fail as a whole — refusing forty leads because one is
 * missing a guest count would just push people back to changing them one by
 * one — so this partitions instead, and the caller reports how many it skipped.
 */
export async function guardLeadStatusChangeMany(
  db: Db,
  leadIds: string[],
  nextStatus: string,
  now: Date = new Date()
): Promise<{
  allowed: { id: string; stamps: { qualifiedAt?: Date; wonAt?: Date } }[];
  blocked: { id: string; error: string }[];
}> {
  const leads = await db.lead.findMany({
    where: { id: { in: leadIds } },
    select: {
      id: true,
      eventDate: true,
      guestCount: true,
      eventType: true,
      locationConfirmed: true,
      bookingValue: true,
      qualifiedAt: true,
      wonAt: true,
    },
  });

  const allowed: { id: string; stamps: { qualifiedAt?: Date; wonAt?: Date } }[] = [];
  const blocked: { id: string; error: string }[] = [];

  for (const lead of leads) {
    const ruled = validateLeadStatusChange(nextStatus, {
      eventDate: lead.eventDate,
      guestCount: lead.guestCount,
      eventType: lead.eventType,
      locationConfirmed: lead.locationConfirmed,
      bookingValue: lead.bookingValue,
    });
    if (!ruled.ok) {
      blocked.push({ id: lead.id, error: ruled.error });
      continue;
    }
    allowed.push({
      id: lead.id,
      stamps: stampsForStatus(
        nextStatus,
        { qualifiedAt: lead.qualifiedAt, wonAt: lead.wonAt },
        now
      ),
    });
  }

  return { allowed, blocked };
}

/**
 * Apply a status to one lead through the guard, for the callers that only need
 * "set it if allowed" and have no other fields to write.
 */
export async function setLeadStatusGuarded(
  db: Db,
  leadId: string,
  nextStatus: string,
  extra: Record<string, unknown> = {}
): Promise<LeadStatusGuard> {
  const guard = await guardLeadStatusChange(db, leadId, nextStatus);
  if (!guard.ok) return guard;
  await db.lead.update({
    where: { id: leadId },
    data: { status: nextStatus as never, ...guard.stamps, ...extra },
  });
  return guard;
}
