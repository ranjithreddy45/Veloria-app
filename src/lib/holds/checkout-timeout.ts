import { CHECKOUT_GRACE_MS } from "./lapsed-hold";

// ============================================================
// Closing a Razorpay checkout before its protection runs out — pure.
// ------------------------------------------------------------
// A checkout started in the last CHECKOUT_GRACE_MS (15 minutes) keeps a hold
// from lapsing (lapsed-hold.ts). A checkout left open longer than that would
// let a customer pay after the protection ended, when the hold may already
// have been released and its date offered to someone else.
//
// So every checkout that can pay for a HOLD passes Razorpay's `timeout`
// option, RAZORPAY_CHECKOUT_TIMEOUT_SECONDS: the checkout closes a minute
// before the protection ends, leaving that minute for a last-moment payment to
// be captured and recorded. If Razorpay has not closed it
// CHECKOUT_CLOSE_FALLBACK_MS after it opened, the page closes it itself, still
// inside the protection.
//
// A checkout that closes on its timeout must say so ("checkout timed out, try
// again"): never a silent reset, never a success. checkoutClosedByTimeout()
// tells that close apart from the customer closing the checkout.
//
// Pure and client-safe: lapsed-hold.ts imports Prisma for types only.
// ============================================================

/** How long before a started checkout's protection ends the checkout closes. */
export const CHECKOUT_CLOSE_MARGIN_MS = 60 * 1000;

/**
 * Razorpay Checkout's `timeout` (whole seconds) for a checkout protected for
 * `graceMs`, closing `marginMs` before that protection ends. At least 1.
 */
export function checkoutTimeoutSeconds(
  graceMs: number = CHECKOUT_GRACE_MS,
  marginMs: number = CHECKOUT_CLOSE_MARGIN_MS
): number {
  return Math.max(1, Math.floor((graceMs - marginMs) / 1000));
}

/** Razorpay Checkout's `timeout` option for every checkout that can pay for a hold: 840 seconds (14 minutes). */
export const RAZORPAY_CHECKOUT_TIMEOUT_SECONDS = checkoutTimeoutSeconds();

/** How long after Razorpay's timeout the page closes a checkout that is somehow still open. */
const FALLBACK_AFTER_TIMEOUT_MS = 15 * 1000;

/** The page's own close for a checkout Razorpay left open: 855 seconds after opening, still inside the 15 minutes. */
export const CHECKOUT_CLOSE_FALLBACK_MS = RAZORPAY_CHECKOUT_TIMEOUT_SECONDS * 1000 + FALLBACK_AFTER_TIMEOUT_MS;

/** A close this near the timeout, by the page's clock, still counts as the timeout. */
const TIMEOUT_TOLERANCE_MS = 2 * 1000;

/**
 * Did the checkout close on its timeout rather than by the customer? true when
 * it had been open for the whole timeout, or when Razorpay passes the reason
 * "timeout" (its docs give ondismiss no argument; one is honoured if passed).
 * false for a checkout that never opened (openedAtMs 0).
 */
export function checkoutClosedByTimeout(
  openedAtMs: number,
  closedAtMs: number,
  reason?: unknown,
  timeoutSeconds: number = RAZORPAY_CHECKOUT_TIMEOUT_SECONDS
): boolean {
  if (reason === "timeout") return true;
  if (!(openedAtMs > 0) || !Number.isFinite(closedAtMs)) return false;
  return closedAtMs - openedAtMs >= timeoutSeconds * 1000 - TIMEOUT_TOLERANCE_MS;
}

// ---- What the customer is told -----------------------------------------------
// When checkout times out the page doesn't know whether money moved, so nothing
// here says a payment did or didn't go through. It asks the customer to try
// again, and to check with the team first if money has already left their account.

export const CHECKOUT_TIMED_OUT_TITLE = "Checkout timed out";

export const CHECKOUT_TIMED_OUT_DETAIL =
  "The checkout closed before a payment was confirmed. Please try again. If money has already left your account, don't pay again: contact us so we can check it first.";

/** Title and detail as one line, for places that show a single error message. */
export const CHECKOUT_TIMED_OUT_MESSAGE = `${CHECKOUT_TIMED_OUT_TITLE}. ${CHECKOUT_TIMED_OUT_DETAIL}`;
