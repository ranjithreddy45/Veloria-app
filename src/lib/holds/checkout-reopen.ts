import { CHECKOUT_GRACE_MS, isHoldLapsed, type HoldFacts } from "./lapsed-hold";
import { holdCheckoutRefusal, type HoldCheckoutRefusal } from "./checkout-guard";
import { CHECKOUT_CLOSE_MARGIN_MS } from "./checkout-timeout";

// ============================================================
// Reopening a checkout on an order the customer already started — pure.
// ------------------------------------------------------------
// A dismissed checkout can be reopened on the same Razorpay order (the split
// link does this rather than piling up pending payments). But a started
// checkout protects a hold for CHECKOUT_GRACE_MS from when its order was
// CREATED (lapsed-hold.ts), and reopening adds nothing. A reopened checkout
// given the usual 840 seconds could outlive that protection: the hold could be
// released while the customer is still paying.
//
// So an open order is reopened only while at least REOPEN_MIN_PROTECTION_MS of
// its protection is left: the one-minute close margin (checkout-timeout.ts)
// plus REOPEN_MIN_USABLE_MS, three minutes, long enough to finish a UPI, card
// or net-banking payment. The reopened checkout closes a minute before the
// protection ends. With less left, a NEW order opens only where
// holdCheckoutRefusal allows one (a new order restarts the protection, which
// must not keep an expired hold alive); otherwise the customer is refused in
// the pay links' words.
// ============================================================

/** The shortest checkout worth reopening: three minutes to finish paying. */
export const REOPEN_MIN_USABLE_MS = 3 * 60 * 1000;

/** Protection an open order must have left to be reopened: the close margin plus the usable window, four minutes. */
export const REOPEN_MIN_PROTECTION_MS = CHECKOUT_CLOSE_MARGIN_MS + REOPEN_MIN_USABLE_MS;

type Dateish = Date | string | null | undefined;

/**
 * Razorpay's `timeout` (whole seconds) for reopening an order created at
 * `orderCreatedAt`: the protection it has left minus the close margin. null
 * when less than REOPEN_MIN_PROTECTION_MS is left or the time can't be read.
 * An order stamped slightly in the future counts as brand new.
 */
export function reopenedCheckoutTimeoutSeconds(orderCreatedAt: Dateish, now: Date): number | null {
  if (orderCreatedAt === null || orderCreatedAt === undefined) return null;
  const created = (orderCreatedAt instanceof Date ? orderCreatedAt : new Date(orderCreatedAt)).getTime();
  if (!Number.isFinite(created)) return null;
  const left = CHECKOUT_GRACE_MS - Math.max(0, now.getTime() - created);
  if (left < REOPEN_MIN_PROTECTION_MS) return null;
  return Math.floor((left - CHECKOUT_CLOSE_MARGIN_MS) / 1000);
}

export type OpenOrderDecision =
  /** Reopen the open order; its checkout closes after `timeoutSeconds`. */
  | { kind: "REOPEN"; timeoutSeconds: number }
  /** Open a new order: full protection and the usual timeout. */
  | { kind: "NEW_ORDER" }
  /** Neither: refuse, with the pay links' words for `refusal`. */
  | { kind: "REFUSE"; refusal: HoldCheckoutRefusal };

/**
 * A customer starts paying again. `openOrderCreatedAt` is when the open order
 * that could be reopened was created: null when there is none. A lapsed hold is
 * refused first, as the pay links do.
 */
export function openOrderDecision(input: {
  booking: HoldFacts | null | undefined;
  openOrderCreatedAt: Dateish;
  now: Date;
}): OpenOrderDecision {
  const { booking, openOrderCreatedAt, now } = input;
  if (booking && isHoldLapsed(booking, now)) return { kind: "REFUSE", refusal: "HOLD_LAPSED" };
  const timeoutSeconds = reopenedCheckoutTimeoutSeconds(openOrderCreatedAt, now);
  if (timeoutSeconds !== null) return { kind: "REOPEN", timeoutSeconds };
  const refusal = holdCheckoutRefusal(booking, now);
  return refusal ? { kind: "REFUSE", refusal } : { kind: "NEW_ORDER" };
}
