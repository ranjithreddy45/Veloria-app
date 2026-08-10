import { prisma } from "@/lib/prisma";

// ============================================================
// Lead engagement — how much attention a lead has actually had.
//
// THE PROBLEM: every touch was already being recorded, and none of it could be
// counted. Three tables hold engagement and they never meet:
//
//   CrmNote        notes + logged calls      keyed on leadId (and contactId)
//   Communication  email / SMS / WhatsApp    keyed on contactId ONLY
//   CallLog        click-to-call             keyed on contactId ONLY
//
// Two of the three do not know what a lead IS. So "how many times has this lead
// been engaged?" had no answer, and every follow-up queue was blind in the way
// that matters: it could not tell a lead that had been chased five times with no
// reply from one nobody had ever picked up the phone for. Both look identical
// when all you have is a status and a date.
//
// THE APPROACH: derive, don't duplicate. The three tables remain the source of
// truth; this recomputes a roll-up onto the Lead so the list can sort by it.
// Recomputing (rather than incrementing at each of ~10 write sites) means:
//   - all EXISTING history counts immediately, with no migration script — which
//     matters because there is no way to run one against the production DB;
//   - a write site nobody remembered to wire up self-heals on the next run
//     instead of drifting quietly for months.
//
// Cost of that choice: counters lag until the next reconcile. `touchLead()`
// exists for the paths where an immediate bump is worth it; it is an
// optimisation, never the record itself.
// ============================================================

/** The channels that count as engaging a lead. */
export type TouchKind = "NOTE" | "CALL" | "EMAIL" | "SMS" | "WHATSAPP" | "MEETING";

/**
 * Map a Communication.type onto a touch kind.
 *
 * Unknown or newly-added channel types fall back to EMAIL rather than being
 * dropped: an
 * uncounted touch is a worse error than a slightly mislabelled one, because it
 * makes a worked lead look neglected.
 */
function communicationKind(type: string): TouchKind {
  switch (type.toUpperCase()) {
    case "SMS":
      return "SMS";
    case "WHATSAPP":
      return "WHATSAPP";
    case "CALL":
    case "PHONE":
      return "CALL";
    case "MEETING":
      return "MEETING";
    default:
      return "EMAIL";
  }
}

/**
 * INBOUND messages are not engagement.
 *
 * The customer replying is a signal to act on, not evidence the team acted. If
 * inbound counted, a lead the customer chased four times while the rep ignored
 * it would look like the best-worked lead on the board — precisely backwards.
 */
const OUTBOUND_ONLY = { direction: "OUTBOUND" as const };

/**
 * Recompute the engagement roll-up for a set of leads (all open ones by
 * default) from the source tables.
 *
 * Idempotent: running it twice changes nothing. Safe to run on a cron and safe
 * to run by hand.
 */
export async function reconcileLeadEngagement(
  opts: { leadIds?: string[]; limit?: number } = {}
): Promise<{ scanned: number; updated: number }> {
  const leads = await prisma.lead.findMany({
    where: opts.leadIds
      ? { id: { in: opts.leadIds } }
      : { deletedAt: null, status: { notIn: ["WON", "LOST"] } },
    select: {
      id: true,
      contactId: true,
      touchCount: true,
      lastTouchedAt: true,
      lastTouchKind: true,
    },
    take: opts.limit ?? 2000,
  });

  let updated = 0;

  for (const lead of leads) {
    // Notes and logged calls hang off the lead directly.
    const notes = await prisma.crmNote.findMany({
      where: { leadId: lead.id },
      select: { kind: true, createdAt: true },
    });

    // Email/SMS/WhatsApp and click-to-call are recorded against the CONTACT, so
    // they are only attributable to a lead through it. A lead with no contact
    // simply has none of these — not an error.
    const comms = lead.contactId
      ? await prisma.communication.findMany({
          where: { contactId: lead.contactId, ...OUTBOUND_ONLY },
          select: { type: true, createdAt: true },
        })
      : [];
    const calls = lead.contactId
      ? await prisma.callLog.findMany({
          where: { contactId: lead.contactId },
          select: { createdAt: true },
        })
      : [];

    const touches: { kind: TouchKind; at: Date }[] = [
      ...notes.map((n) => ({
        kind: (n.kind === "CALL" ? "CALL" : "NOTE") as TouchKind,
        at: n.createdAt,
      })),
      ...comms.map((c) => ({ kind: communicationKind(String(c.type)), at: c.createdAt })),
      ...calls.map((c) => ({ kind: "CALL" as TouchKind, at: c.createdAt })),
    ];

    const touchCount = touches.length;
    let lastTouchedAt: Date | null = null;
    let lastTouchKind: string | null = null;
    for (const t of touches) {
      if (!lastTouchedAt || t.at > lastTouchedAt) {
        lastTouchedAt = t.at;
        lastTouchKind = t.kind;
      }
    }

    // Only write when something actually changed — this runs over every open
    // lead nightly and a no-op UPDATE per row is pure write amplification.
    const same =
      lead.touchCount === touchCount &&
      lead.lastTouchKind === lastTouchKind &&
      (lead.lastTouchedAt?.getTime() ?? null) === (lastTouchedAt?.getTime() ?? null);
    if (same) continue;

    await prisma.lead.update({
      where: { id: lead.id },
      data: { touchCount, lastTouchedAt, lastTouchKind },
    });
    updated++;
  }

  return { scanned: leads.length, updated };
}

/**
 * Bump the roll-up immediately after a touch, so the rep who just logged a call
 * sees it reflected without waiting for the nightly pass.
 *
 * Best-effort and deliberately swallowing: this is a derived counter, and the
 * real record has already been written by the caller. Failing a rep's "log
 * call" action because a denormalised integer would not increment is the wrong
 * trade — the next reconcile corrects it anyway.
 */
export async function touchLead(
  leadId: string | null | undefined,
  kind: TouchKind,
  at: Date = new Date()
): Promise<void> {
  if (!leadId) return;
  try {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        touchCount: { increment: 1 },
        lastTouchedAt: at,
        lastTouchKind: kind,
      },
    });
  } catch {
    /* reconcile will pick it up */
  }
}

/**
 * How stale a lead is, in whole days since the last touch.
 * `null` means it has never been touched at all — which is worse than any
 * number, and callers must not render it as 0.
 */
export function daysSinceTouch(lastTouchedAt: Date | null | undefined, now = new Date()): number | null {
  if (!lastTouchedAt) return null;
  return Math.floor((now.getTime() - lastTouchedAt.getTime()) / 86_400_000);
}
