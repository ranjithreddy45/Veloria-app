// ============================================================
// Empty-Date Sell-Down — pure (no-IO) core engine.
// ------------------------------------------------------------
// Given an in-memory snapshot of active venues, non-CANCELLED bookings,
// whole-day/partial blackouts, and OPEN leads in a forward UTC window, this
// derives, per (venueId, date, BOOKABLE slot):
//   - occupancyPct  (0..100, SAME UTC-day bucketing + FULL_DAY-blocks-all-slots
//                     semantics as getAvailabilityGrid / yield-demand-refresh)
//   - isPeakDate     (DERIVED — there is NO peak field on Venue: weekend OR
//                     high lead-inquiry density on that venue/day OR
//                     blackout-adjacent to a neighbouring day)
//   - matchedLeadIds (OPEN leads whose eventDate falls on that UTC day, scored
//                     by preferredVenue / eventType / guestCount alignment)
//
// It is kept pure so the daily cron AND the on-demand "Refresh now" action can
// reuse one engine and it stays unit-testable. No prisma, no Date.now() beyond
// the explicit `windowStartKey` the caller passes in.
//
// UTC @db.Date trap: Booking.date / SellDownTarget.date are @db.Date and read
// back as UTC-midnight. We bucket by toISOString().slice(0,10) and write dates
// as new Date(key+"T00:00:00.000Z") — identical to getAvailabilityGrid and the
// yield cron — so occupancy never mis-buckets across timezones.
// ============================================================

import type { TimeSlot } from "@prisma/client";

// Forward window the board + cron scan (today .. +N UTC days).
export const SELL_DOWN_WINDOW_DAYS = 60;

// A (venue,date,slot) is "low occupancy" — i.e. perishable inventory worth
// chasing — when its occupancy is at or below this percentage.
export const LOW_OCCUPANCY_PCT_MAX = 50;

// Only fully-bookable partial slots + FULL_DAY are sell-down targets.
export const SELL_DOWN_SLOTS: TimeSlot[] = ["MORNING", "AFTERNOON", "EVENING", "FULL_DAY"];
const PARTIAL_SLOTS: TimeSlot[] = ["MORNING", "AFTERNOON", "EVENING"];

// ------------------------------------------------------------
// Snapshot input shapes (caller pulls these from prisma once).
// ------------------------------------------------------------
export interface SellDownVenue {
  id: string;
  capacity: number;
}
export interface SellDownBooking {
  venueId: string;
  date: Date; // @db.Date → UTC-midnight
  timeSlot: TimeSlot | null;
}
export interface SellDownBlackout {
  venueId: string;
  date: Date; // @db.Date → UTC-midnight
  timeSlot: TimeSlot | null; // null = whole-day blackout
}
export interface SellDownLead {
  id: string;
  eventDate: Date | null;
  eventType: string | null;
  guestCount: number | null;
  preferredVenueId: string | null;
  score: number;
}

export interface SellDownTargetDraft {
  venueId: string;
  dateKey: string; // "YYYY-MM-DD" — UTC day key
  timeSlot: TimeSlot;
  occupancyPct: number; // 0..100
  isPeakDate: boolean;
  matchedLeadIds: string[];
  matchedLeadCount: number;
}

// ------------------------------------------------------------
// UTC day helpers — mirror yield-demand-refresh exactly.
// ------------------------------------------------------------
export function utcDayKey(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}
export function utcDateFromKey(key: string): Date {
  return new Date(key + "T00:00:00.000Z");
}

// True when the UTC day key falls on Saturday/Sunday.
function isWeekendKey(key: string): boolean {
  const dow = utcDateFromKey(key).getUTCDay(); // 0=Sun .. 6=Sat
  return dow === 0 || dow === 6;
}

// ------------------------------------------------------------
// Lead → target matching. Public so the action layer can re-score on read.
// A lead matches a (venueId, dateKey) when its eventDate lands on that UTC day.
// Score rewards alignment so reps chase the best-fit leads first.
// ------------------------------------------------------------
export function matchLeadsToTarget(
  venueId: string,
  dateKey: string,
  venueCapacity: number,
  leads: SellDownLead[]
): { id: string; matchScore: number }[] {
  const out: { id: string; matchScore: number }[] = [];
  for (const l of leads) {
    if (!l.eventDate) continue;
    if (utcDayKey(l.eventDate) !== dateKey) continue;

    // Base relevance from the lead's own pipeline score (0..100ish → 0..40).
    let matchScore = Math.min(40, Math.max(0, Math.round(l.score / 2.5)));

    // Strong signal: the lead already prefers THIS venue.
    if (l.preferredVenueId && l.preferredVenueId === venueId) matchScore += 35;
    // A lead with no venue preference is still a candidate (any open venue),
    // but a lead that prefers a DIFFERENT venue is a weaker fit.
    else if (l.preferredVenueId && l.preferredVenueId !== venueId) matchScore += 5;
    else matchScore += 15;

    // Guest count fits the hall capacity (not a wildly-too-large party).
    if (l.guestCount && venueCapacity > 0 && l.guestCount <= venueCapacity) {
      const fill = l.guestCount / venueCapacity;
      if (fill >= 0.4) matchScore += 15; // a meaningful fill, great fit
      else matchScore += 8;
    }

    // An identified event type is a slightly better lead to engage.
    if (l.eventType) matchScore += 5;

    out.push({ id: l.id, matchScore: Math.min(100, matchScore) });
  }
  // Best-fit leads first.
  out.sort((a, b) => b.matchScore - a.matchScore);
  return out;
}

// ------------------------------------------------------------
// Board read shapes — consumed by the action + the board UI. Kept here (a
// non-"use server" module) so the action file can export only async fns.
// ------------------------------------------------------------
export interface SellDownMatchedLead {
  id: string;
  title: string;
  contactName: string | null;
  eventDate: string | null; // ISO
  eventType: string | null;
  guestCount: number | null;
  score: number;
  assignedToName: string | null;
}
export interface SellDownTargetView {
  id: string;
  venueId: string;
  venueName: string;
  dateISO: string; // UTC day key "YYYY-MM-DD"
  timeSlot: TimeSlot;
  slotLabel: string;
  occupancyPct: number; // Number() at the boundary
  isPeakDate: boolean;
  status: string; // OPEN | WORKING | FILLED | EXPIRED
  matchedLeadCount: number;
  matchedLeads: SellDownMatchedLead[];
  computedAt: string; // ISO
}
export interface SellDownKpis {
  openPeakSlots: number;
  perishableNights: number; // distinct venue/date combos with a low-occ slot
  matchedLeadCoveragePct: number; // % of open targets that have ≥1 matched lead
  totalMatchedLeads: number;
}
export interface SellDownBoardData {
  targets: SellDownTargetView[];
  kpis: SellDownKpis;
  computedAt: string | null; // freshest computedAt across the board
}

interface DayState {
  fullDay: boolean;
  partials: Set<TimeSlot>;
}

// ------------------------------------------------------------
// Core: compute low-occupancy target drafts across the forward window.
//   windowStartKey  — "YYYY-MM-DD" UTC day key for "today" (inclusive)
//   windowDays      — number of days to scan forward
//   lowOccupancyMax — occupancy at or below this is a target (default const)
// Returns ONLY the low-occupancy (perishable) slots, each with matched leads.
// ------------------------------------------------------------
export function computeSellDownDrafts(input: {
  venues: SellDownVenue[];
  bookings: SellDownBooking[];
  blackouts: SellDownBlackout[];
  leads: SellDownLead[];
  windowStartKey: string;
  windowDays?: number;
  lowOccupancyMax?: number;
  /**
   * Date keys ("YYYY-MM-DD") that carry a date-demand premium and must NEVER be
   * offered as sell-down (discount) targets. We never auto-suggest discounting a
   * scarce date. Two sources are excluded:
   *   - weekends (derived here from the UTC weekday), and
   *   - active PeakDate rows (Muhurtham / festival / custom) the caller passes in.
   * Caller passes the all-venues + venue-specific peak keys; a venue-scoped peak
   * key is encoded as "venueId|YYYY-MM-DD".
   */
  peakDateKeys?: Set<string>;
}): SellDownTargetDraft[] {
  const {
    venues,
    bookings,
    blackouts,
    leads,
    windowStartKey,
    windowDays = SELL_DOWN_WINDOW_DAYS,
    lowOccupancyMax = LOW_OCCUPANCY_PCT_MAX,
    peakDateKeys,
  } = input;

  if (venues.length === 0) return [];

  const capacityById = new Map<string, number>();
  for (const v of venues) capacityById.set(v.id, v.capacity);

  // Booking occupancy state per venue+day.
  const stateByKey = new Map<string, DayState>();
  function dayState(venueId: string, dayKey: string): DayState {
    const key = `${venueId}|${dayKey}`;
    let s = stateByKey.get(key);
    if (!s) {
      s = { fullDay: false, partials: new Set<TimeSlot>() };
      stateByKey.set(key, s);
    }
    return s;
  }
  for (const b of bookings) {
    const s = dayState(b.venueId, utcDayKey(b.date));
    if (b.timeSlot === "FULL_DAY") s.fullDay = true;
    else if (b.timeSlot) s.partials.add(b.timeSlot);
  }

  // Blackout index: set of "venueId|dayKey" with a whole-day blackout (used for
  // both blocking the day and the blackout-adjacent peak heuristic).
  const wholeDayBlackoutKeys = new Set<string>();
  // Slot-level blackout per venue+day so we can mark that specific cell full.
  const slotBlackoutKeys = new Set<string>(); // "venueId|dayKey|SLOT"
  for (const x of blackouts) {
    const dayKey = utcDayKey(x.date);
    if (x.timeSlot === null) wholeDayBlackoutKeys.add(`${x.venueId}|${dayKey}`);
    else slotBlackoutKeys.add(`${x.venueId}|${dayKey}|${x.timeSlot}`);
  }

  // Inquiry density per venue+day → drives the high-demand peak heuristic.
  const inquiryByKey = new Map<string, number>();
  for (const l of leads) {
    if (!l.eventDate || !l.preferredVenueId) continue;
    const key = `${l.preferredVenueId}|${utcDayKey(l.eventDate)}`;
    inquiryByKey.set(key, (inquiryByKey.get(key) ?? 0) + 1);
  }
  // A venue/day is "high demand" (peak) when inquiries meet this density.
  const PEAK_INQUIRY_MIN = 2;

  const start = utcDateFromKey(windowStartKey);
  const drafts: SellDownTargetDraft[] = [];

  for (const venue of venues) {
    const venueId = venue.id;
    const capacity = capacityById.get(venueId) ?? 0;

    for (let i = 0; i < windowDays; i++) {
      const dayDate = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const dayKey = utcDayKey(dayDate);
      const s = dayState(venueId, dayKey);

      // Whole-day blackout → not sellable inventory, skip entirely.
      if (wholeDayBlackoutKeys.has(`${venueId}|${dayKey}`)) continue;

      // Date-demand exclusion: NEVER suggest discounting a scarce, premium date.
      // Skip weekends and any active PeakDate (all-venues "YYYY-MM-DD" key or
      // venue-scoped "venueId|YYYY-MM-DD" key) entirely from the sell-down board.
      if (
        isWeekendKey(dayKey) ||
        peakDateKeys?.has(dayKey) ||
        peakDateKeys?.has(`${venueId}|${dayKey}`)
      ) {
        continue;
      }

      const inquiryCount = inquiryByKey.get(`${venueId}|${dayKey}`) ?? 0;

      // Peak heuristic (DERIVED, documented, consistent cron↔on-demand):
      //   weekend OR high inquiry density OR blackout-adjacent (a neighbouring
      //   UTC day is blacked out → this day sits next to a constrained window).
      const prevKey = utcDayKey(new Date(dayDate.getTime() - 24 * 60 * 60 * 1000));
      const nextKey = utcDayKey(new Date(dayDate.getTime() + 24 * 60 * 60 * 1000));
      const blackoutAdjacent =
        wholeDayBlackoutKeys.has(`${venueId}|${prevKey}`) ||
        wholeDayBlackoutKeys.has(`${venueId}|${nextKey}`);
      const isPeakDate =
        isWeekendKey(dayKey) || inquiryCount >= PEAK_INQUIRY_MIN || blackoutAdjacent;

      for (const slot of SELL_DOWN_SLOTS) {
        // Slot-level blackout → that cell is blocked, not perishable.
        if (slotBlackoutKeys.has(`${venueId}|${dayKey}|${slot}`)) continue;

        let occupancyPct: number;
        if (slot === "FULL_DAY") {
          if (s.fullDay) occupancyPct = 100;
          else occupancyPct = Math.round((s.partials.size / PARTIAL_SLOTS.length) * 100);
        } else {
          // FULL_DAY booking blocks every partial slot.
          occupancyPct = s.fullDay || s.partials.has(slot) ? 100 : 0;
        }

        if (occupancyPct > lowOccupancyMax) continue; // not perishable

        const matched = matchLeadsToTarget(venueId, dayKey, capacity, leads);
        drafts.push({
          venueId,
          dateKey: dayKey,
          timeSlot: slot,
          occupancyPct,
          isPeakDate,
          matchedLeadIds: matched.map((m) => m.id),
          matchedLeadCount: matched.length,
        });
      }
    }
  }

  return drafts;
}
