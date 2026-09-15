import { holdMoneyState, isHoldLapsed, isHoldPastExpiry, type HoldFacts, type HoldInvoiceFacts } from "./lapsed-hold";

// ============================================================
// Opening a NEW checkout on a HOLD booking — pure.
// ------------------------------------------------------------
// A Razorpay checkout started in the last CHECKOUT_GRACE_MS keeps a hold from
// lapsing (lapsed-hold.ts), because the customer may be paying at that moment.
// If every new order restarted that grace, reopening checkout every few
// minutes would keep an expired hold, and its date, forever.
//
// So once holdExpiresAt has passed, a NEW order is refused unless the booking
// already has money that does not depend on the grace: a paid or part-paid
// invoice, a completed or processing payment, or a proof awaiting
// verification. A checkout started before expiry keeps protecting the hold
// exactly as before, and a payment it captures later is still recorded.
//
// The lapsed-hold rule itself is untouched: this only decides whether one more
// checkout may start. Used by every public pay path (the invoice link and the
// split link) so they refuse the same holds with the same words.
// ============================================================

/** A lapsed hold (window passed, no money, no checkout in flight). */
export const HOLD_LAPSED_CHECKOUT_ERROR = "This hold has lapsed, so the date is no longer reserved. Please start again.";

/** The window passed and only a checkout started earlier still protects the hold. */
export const HOLD_WINDOW_CLOSED_CHECKOUT_ERROR =
  "The time to pay for this hold has run out, so a new payment can't be started. A payment you completed a moment ago will still be applied; otherwise please start again.";

/** Drop checkouts that are only open (PENDING, no proof): what is left is money that does not rely on the grace window. */
function withoutOpenCheckouts(invoices: readonly HoldInvoiceFacts[] | undefined): HoldInvoiceFacts[] {
  return (invoices ?? []).map((inv) => ({
    ...inv,
    payments: (inv.payments ?? []).filter((p) => !(p.status === "PENDING" && p.receiptUploadedAt == null)),
  }));
}

/**
 * true when a NEW checkout must not be opened for this booking: a HOLD past
 * its window whose only protection, if any, is a checkout already started.
 * Every lapsed hold answers true as well; a booking that is not a HOLD, or has
 * no window, never does.
 */
export function newCheckoutWouldExtendHold(b: HoldFacts, now: Date = new Date()): boolean {
  return isHoldPastExpiry(b, now) && holdMoneyState(withoutOpenCheckouts(b.invoices), now) === "NONE";
}

// ---- One decision for every pay path -----------------------------------------

/** Why a NEW checkout must not open on a booking. */
export type HoldCheckoutRefusal = "HOLD_LAPSED" | "HOLD_WINDOW_CLOSED";

/**
 * The two rules above, in the order the public pay links apply them: a lapsed
 * hold first, then a hold past its window whose only protection is a checkout
 * already started. null when a new checkout may open, and for no booking.
 */
export function holdCheckoutRefusal(
  b: HoldFacts | null | undefined,
  now: Date = new Date()
): HoldCheckoutRefusal | null {
  if (!b) return null;
  if (isHoldLapsed(b, now)) return "HOLD_LAPSED";
  if (newCheckoutWouldExtendHold(b, now)) return "HOLD_WINDOW_CLOSED";
  return null;
}

/** What a customer is told, wherever they pay: the invoice link, a split link or the portal. */
export const CUSTOMER_HOLD_CHECKOUT_ERROR: Record<HoldCheckoutRefusal, string> = {
  HOLD_LAPSED: HOLD_LAPSED_CHECKOUT_ERROR,
  HOLD_WINDOW_CLOSED: HOLD_WINDOW_CLOSED_CHECKOUT_ERROR,
};

/** What the team is told when they start an online payment: the fix is on the booking. */
export const STAFF_HOLD_CHECKOUT_ERROR: Record<HoldCheckoutRefusal, string> = {
  HOLD_LAPSED:
    "This hold has lapsed: its window passed with no payment, so the date is no longer reserved. Extend the hold first (or start a new one), then take the payment.",
  HOLD_WINDOW_CLOSED:
    "This hold's window has passed, so a new online payment can't be started on it. Extend the hold first (or start a new one), then take the payment. A payment the customer has already completed will still be applied.",
};
