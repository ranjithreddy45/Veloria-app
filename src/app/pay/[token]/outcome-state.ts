import { holdHasMoney, type HoldFacts } from "@/lib/holds/lapsed-hold";

// ============================================================
// /pay outcome: is the booking this payment belongs to live? — pure.
// ------------------------------------------------------------
// After a verified payment, "Open your event in the app" and "Add to calendar"
// are offered only for a booking that is on: TENTATIVE, CONFIRMED, IN_PROGRESS,
// or a HOLD with money against it (lapsed-hold.ts).
//
// A payment can land on a CANCELLED booking: a checkout captured after its hold
// was released, or a cancellation while the customer was paying. That payment
// is recorded and the team is alerted (src/lib/holds/paid-without-slot.ts). The
// customer is told the booking isn't active, rather than being sent to an event
// that isn't happening. A COMPLETED event, or a HOLD with nothing against it,
// gets neither the links nor the notice.
//
// Pure and client-safe: lapsed-hold.ts imports Prisma for types only.
// ============================================================

export type OutcomeBookingState = "LIVE" | "CANCELLED" | "INACTIVE";

const LIVE_STATUSES: ReadonlySet<string> = new Set(["TENTATIVE", "CONFIRMED", "IN_PROGRESS"]);

export function outcomeBookingState(b: HoldFacts, now: Date = new Date()): OutcomeBookingState {
  if (b.status === "CANCELLED") return "CANCELLED";
  if (LIVE_STATUSES.has(b.status)) return "LIVE";
  if (b.status === "HOLD" && holdHasMoney(b.invoices, now)) return "LIVE";
  return "INACTIVE";
}

export const CANCELLED_BOOKING_TITLE = "This booking isn't active";

/**
 * What a customer whose payment landed on a cancelled booking is told. "We've
 * told our team" only when the team's alert about this payment is on record.
 */
export function cancelledBookingNotice(teamAlerted: boolean): string {
  return [
    "Your payment is received and recorded, but this booking has been cancelled, so the date is no longer reserved.",
    teamAlerted ? "We've told our team." : null,
    "Please contact us to re-book or arrange a refund.",
  ]
    .filter(Boolean)
    .join(" ");
}
