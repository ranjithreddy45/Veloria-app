// ============================================================
// What "Qualified" and "Won" are allowed to mean.
// ------------------------------------------------------------
// WHY. Google Ads only learns from what we send back, and until now the only
// signal it got was "a form was submitted". It optimised accordingly: of 346
// Google Ads leads, none ever reached Won. Sending "Qualified" back is only
// worth doing if Qualified means something a machine can trust, so it stops
// being a feeling and becomes four facts:
//
//   event date · guest count ≥ 50 · event type · the customer confirmed Hosa Road
//
// and Won stops being a status someone drags a card into and requires the
// booking value it is worth.
//
// Pure — no database, no session. Every write path imports these two functions
// rather than repeating the rule, because the rule is only as good as its
// least-guarded call site, and there are a dozen of them.
// ============================================================

export const MIN_QUALIFIED_GUESTS = 50;

/** Everything the rules need to judge a lead. Decimal or number both fine. */
export interface LeadQualificationFacts {
  eventDate?: Date | string | null;
  guestCount?: number | null;
  eventType?: string | null;
  locationConfirmed?: boolean | null;
  bookingValue?: number | string | { toString(): string } | null;
}

function hasText(v?: string | null): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function toNumber(v: LeadQualificationFacts["bookingValue"]): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

/**
 * What is missing before this lead may be called Qualified.
 * Empty array = it may.
 */
export function qualificationGaps(facts: LeadQualificationFacts): string[] {
  const gaps: string[] = [];
  if (!facts.eventDate) gaps.push("event date");
  if (!facts.guestCount || facts.guestCount < MIN_QUALIFIED_GUESTS) {
    gaps.push(`guest count of at least ${MIN_QUALIFIED_GUESTS}`);
  }
  if (!hasText(facts.eventType)) gaps.push("event type");
  if (!facts.locationConfirmed) gaps.push("confirmation that Hosa Road works for the customer");
  return gaps;
}

/** What is missing before this lead may be called Won. */
export function wonGaps(facts: LeadQualificationFacts): string[] {
  return toNumber(facts.bookingValue) > 0 ? [] : ["the booking value in rupees"];
}

export type StatusRuleResult = { ok: true } | { ok: false; error: string };

/**
 * May this lead move to `nextStatus`?
 *
 * Only QUALIFIED and WON are gated. Everything else — including moving a lead
 * backwards, or losing it — stays free, because a rule that blocks someone from
 * recording what actually happened gets worked around instead of followed.
 */
export function validateLeadStatusChange(
  nextStatus: string,
  facts: LeadQualificationFacts
): StatusRuleResult {
  if (nextStatus === "QUALIFIED") {
    const gaps = qualificationGaps(facts);
    if (gaps.length) {
      return {
        ok: false,
        error: `Before marking this lead Qualified, add ${list(gaps)}.`,
      };
    }
  }
  if (nextStatus === "WON") {
    const gaps = wonGaps(facts);
    if (gaps.length) {
      return { ok: false, error: `Before marking this lead Won, add ${list(gaps)}.` };
    }
  }
  return { ok: true };
}

function list(items: string[]): string {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export interface ExistingStamps {
  qualifiedAt?: Date | null;
  wonAt?: Date | null;
}

/**
 * The timestamps to write for this transition — only ever the ones still empty.
 *
 * These are the conversion times reported to Google. If a lead is moved out of
 * Qualified and back in, or re-Won after a correction, the original instant has
 * to survive: Google treats a conversion with a new time as a new conversion,
 * and the campaign would be credited twice for one booking.
 *
 * A lead taken straight to Won was qualified too — nobody books an event they
 * never qualified — so it gets both stamps at the same instant rather than a
 * Won with no Qualified before it, which Google reads as an orphan.
 */
export function stampsForStatus(
  nextStatus: string,
  existing: ExistingStamps,
  now: Date = new Date()
): { qualifiedAt?: Date; wonAt?: Date } {
  const out: { qualifiedAt?: Date; wonAt?: Date } = {};
  if (nextStatus === "QUALIFIED" && !existing.qualifiedAt) out.qualifiedAt = now;
  if (nextStatus === "WON") {
    if (!existing.wonAt) out.wonAt = now;
    if (!existing.qualifiedAt) out.qualifiedAt = out.wonAt ?? now;
  }
  return out;
}
