import { hasPermission } from "@/lib/permissions";
import { isEnquirySource } from "@/lib/enquiry-source";
import { resolveBdRange, istDateStr } from "@/lib/acq/analytics-range";

// ============================================================
// ONE definition of "which leads match these filters".
//
// This used to live inside lead.actions.ts as a private function, which meant
// the CSV export could not reach it — so `exportLeads()` took no filters at all
// and always dumped everything the caller was allowed to see. Someone filtering
// to Google Ads in August and pressing Export got the entire book, silently,
// with no indication the filters had been ignored.
//
// Copying the where-clause into the export would have fixed the symptom and
// guaranteed the next bug: two filter implementations drifting apart, so the
// screen and the file disagree about what "these leads" means. That is the
// failure mode this codebase keeps producing, so the definition moved here
// instead and both callers import it.
//
// A plain module, NOT "use server" — those may only export async functions, and
// this exports types and a synchronous builder.
// ============================================================

// Allowed filter values — an invalid enum string passed straight to Prisma throws
// a generic error, so we validate against these sets and ignore unknown values.
const LEAD_STATUS_VALUES = new Set<string>([
  "NEW", "NOT_CONNECTED", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST",
]);
const LEAD_SOURCE_VALUES = new Set<string>([
  "WEBSITE", "REFERRAL", "SOCIAL_MEDIA", "WALK_IN", "PHONE_INQUIRY", "EMAIL",
  "EVENT", "PARTNER", "ADVERTISEMENT", "FACEBOOK_ADS", "GOOGLE_ADS", "INDIAMART",
  "JUSTDIAL", "WEDMEGOOD", "INSTAGRAM", "WHATSAPP", "OTHER",
]);


/**
 * Which leads the list shows. Defaults to "mine" (leads assigned to the signed-in
 * user). "all" and "unassigned" are manager views — see `canSeeAllLeads`.
 * "unassigned" is the routing inbox: leads with no owner yet (assignedToId=null).
 */
export type LeadScope = "mine" | "all" | "unassigned";

export interface LeadListFilters {
  search?: string;
  status?: string;
  source?: string;
  /** Event-date period — IST yyyy-mm-dd, inclusive on both ends. */
  eventFrom?: string;
  eventTo?: string;
  /** Lead-creation period — IST yyyy-mm-dd, inclusive on both ends. */
  createdFrom?: string;
  createdTo?: string;
  /**
   * Marketing channel, from `Contact.enquirySource` — the axis ad spend is
   * reconciled against. "NONE" = no channel recorded.
   */
  enquirySource?: string;
  /**
   * The two worklist buckets the leads strip counts.
   *   "overdue"   — follow-up date has passed, lead still open
   *   "untouched" — open and never engaged at all (worse: never even started)
   * These exist so the strip's numbers and the links behind them resolve to the
   * SAME set. A counter that opens a different list than it counted is the
   * silent-mismatch bug this codebase keeps producing.
   */
  due?: string;
  /** Hall/Property (preferred venue). "UNASSIGNED" → leads with no venue. */
  venueId?: string;
  scope?: LeadScope;
}

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * "All leads" is the lead-manager view. It reuses the EXISTING `leads:assign`
 * permission — the one that already distinguishes a lead manager (SUPER_ADMIN /
 * ADMIN / SALES_HEAD) from a rep who only works their own book — rather than
 * introducing a new permission key.
 */
export function canSeeAllLeads(role: string): boolean {
  return hasPermission(role, "leads:assign");
}

/**
 * The absolute [start, end] UTC instants of one IST calendar day. Anchored via
 * the shared BD range resolver so leads use the same IST (+5:30) day boundaries
 * as every other date filter in the app — no bespoke timezone maths here.
 */
function istDayWindow(iso: string | undefined): { start: Date; end: Date } | null {
  if (!iso || !ISO_DAY_RE.test(iso)) return null;
  const r = resolveBdRange("custom", iso, iso);
  // resolveBdRange falls back to "this month" when the pair won't parse, and
  // Date.UTC silently rolls impossible days over (Feb 31 → Mar 3). Reject both by
  // requiring the resolved window to round-trip back to the same IST day.
  if (r.key !== "custom" || istDateStr(r.start) !== iso || istDateStr(r.end) !== iso) {
    return null;
  }
  return { start: r.start, end: r.end };
}

/** Inclusive IST day-range filter; either end may be omitted (open-ended). */
function istRangeFilter(fromISO?: string, toISO?: string): { gte?: Date; lte?: Date } | null {
  const from = istDayWindow(fromISO);
  const to = istDayWindow(toISO);
  if (!from && !to) return null;
  const f: { gte?: Date; lte?: Date } = {};
  if (from) f.gte = from.start; // 00:00:00.000 IST of the "from" day
  if (to) f.lte = to.end; // 23:59:59.999 IST of the "to" day
  return f;
}

/**
 * Builds the list `where` clause plus the EFFECTIVE scope. Scope is resolved
 * server-side from the viewer's role — a client asking for `scope: "all"` without
 * the permission is silently downgraded to "mine", so the query can never widen
 * beyond what the role allows.
 */
export function buildLeadListWhere(
  filters: LeadListFilters | undefined,
  viewer: { id: string; role: string }
): { where: Record<string, unknown>; scope: LeadScope; canViewAll: boolean } {
  // Exclude soft-deleted records by default
  const where: Record<string, unknown> = { deletedAt: null };

  // ---- Ownership scoping (server-authoritative) ----
  const canViewAll = canSeeAllLeads(viewer.role);
  // "all" and "unassigned" are manager-only views; a rep asking for either is
  // silently downgraded to "mine" so the query can never widen past their book.
  const requested = filters?.scope;
  const scope: LeadScope =
    (requested === "all" || requested === "unassigned") && canViewAll
      ? requested
      : "mine";
  if (scope === "mine") {
    where.assignedToId = viewer.id;
  } else if (scope === "unassigned") {
    // The routing inbox: leads that landed with no owner. With the capture-side
    // fallback owner this should stay near-empty, but it's the safety net that
    // guarantees an ownerless lead is always one click away, never hidden.
    where.assignedToId = null;
  }
  // scope === "all" → no assignedToId filter (every lead in the company).

  const search = filters?.search?.trim();
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      {
        contact: {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  // Validate enum filters before querying — an unknown string would otherwise
  // make Prisma throw and surface as a generic "Failed to fetch leads".
  if (filters?.status && LEAD_STATUS_VALUES.has(filters.status)) {
    where.status = filters.status;
  }

  if (filters?.source && LEAD_SOURCE_VALUES.has(filters.source)) {
    where.source = filters.source;
  }

  // Marketing channel — the axis ad spend is actually reconciled against.
  //
  // It lives on the CONTACT (`enquirySource`), not the lead, because it records
  // how the PERSON first reached us; `Lead.source` is a different, finer thing
  // (INDIAMART, JUSTDIAL…). Until now leads could not be filtered by channel at
  // all, so "Google Ads says 88 leads in August" was unanswerable from the CRM —
  // you could see the total, but not the slice the number referred to.
  //
  // "NONE" selects contacts with no channel recorded. Those are real and must
  // stay findable: defaulting them into Direct would invent attribution in a
  // report someone spends money against.
  const OPEN_STATUSES = ["NEW", "NOT_CONNECTED", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION"];
  if (filters?.due === "overdue") {
    where.status = { in: OPEN_STATUSES };
    where.followUpDate = { not: null, lt: new Date() };
  } else if (filters?.due === "untouched") {
    where.status = { in: OPEN_STATUSES };
    where.lastTouchedAt = null;
  }

  const channel = filters?.enquirySource?.trim();
  if (channel === "NONE") {
    where.contact = { ...(where.contact as Record<string, unknown>), enquirySource: null };
  } else if (isEnquirySource(channel)) {
    where.contact = { ...(where.contact as Record<string, unknown>), enquirySource: channel };
  }

  // Event-date period. eventDate is nullable — a lead with no event date simply
  // falls outside the window (Prisma treats NULL as non-matching for gte/lte).
  const eventRange = istRangeFilter(filters?.eventFrom, filters?.eventTo);
  if (eventRange) where.eventDate = eventRange;

  // Lead-creation period.
  const createdRange = istRangeFilter(filters?.createdFrom, filters?.createdTo);
  if (createdRange) where.createdAt = createdRange;

  // Hall/Property (preferred venue). "UNASSIGNED" is the no-venue bucket; any
  // other non-empty value narrows to that venue (a stale id returns no rows).
  const venueId = filters?.venueId?.trim();
  if (venueId === "UNASSIGNED") {
    where.preferredVenueId = null;
  } else if (venueId) {
    where.preferredVenueId = venueId;
  }

  return { where, scope, canViewAll };
}
