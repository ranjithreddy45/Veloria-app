import { describe, it, expect } from "vitest";
import {
  REOPEN_MIN_PROTECTION_MS,
  REOPEN_MIN_USABLE_MS,
  openOrderDecision,
  reopenedCheckoutTimeoutSeconds,
} from "./checkout-reopen";
import { CHECKOUT_CLOSE_MARGIN_MS, RAZORPAY_CHECKOUT_TIMEOUT_SECONDS, checkoutCloseFallbackMs } from "./checkout-timeout";
import {
  CHECKOUT_GRACE_MS,
  isHoldLapsed,
  type HoldFacts,
  type HoldInvoiceFacts,
  type HoldPaymentFacts,
} from "./lapsed-hold";

// ============================================================
// Reopening an order the customer already started gives it no new protection:
// the 15 minutes count from when the order was created. So it is reopened only
// with at least four minutes of protection left (a minute's close margin plus
// three minutes to pay), and its checkout closes a minute before the protection
// ends. Otherwise the hold rule decides whether a new order may open.
// ============================================================

const NOW = new Date("2026-09-16T10:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60 * 1000);
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000);
const hoursAhead = (h: number) => new Date(NOW.getTime() + h * 60 * 60 * 1000);

const unpaid: HoldInvoiceFacts = { status: "SENT", paidAmount: 0, payments: [] };
const checkout = (createdAt: Date): HoldPaymentFacts => ({ status: "PENDING", receiptUploadedAt: null, createdAt });
const hold = (holdExpiresAt: Date | null, ...payments: HoldPaymentFacts[]): HoldFacts => ({
  status: "HOLD",
  holdExpiresAt,
  invoices: [{ status: "SENT", paidAmount: 0, payments }],
});

describe("the reopen threshold", () => {
  it("is the one-minute close margin plus three usable minutes: four minutes of protection", () => {
    expect(REOPEN_MIN_USABLE_MS).toBe(3 * 60 * 1000);
    expect(REOPEN_MIN_PROTECTION_MS).toBe(CHECKOUT_CLOSE_MARGIN_MS + REOPEN_MIN_USABLE_MS);
    expect(REOPEN_MIN_PROTECTION_MS).toBe(4 * 60 * 1000);
  });
});

describe("reopenedCheckoutTimeoutSeconds", () => {
  it("an order created just now gets the usual timeout", () => {
    expect(reopenedCheckoutTimeoutSeconds(NOW, NOW)).toBe(RAZORPAY_CHECKOUT_TIMEOUT_SECONDS);
  });

  it("counts from when the order was created, not from now", () => {
    expect(reopenedCheckoutTimeoutSeconds(minutesAgo(5), NOW)).toBe(9 * 60);
    expect(reopenedCheckoutTimeoutSeconds(minutesAgo(9), NOW)).toBe(5 * 60);
  });

  it("reopens with exactly four minutes left, for three minutes", () => {
    expect(reopenedCheckoutTimeoutSeconds(minutesAgo(11), NOW)).toBe(180);
  });

  it("does not reopen with less than four minutes left", () => {
    expect(reopenedCheckoutTimeoutSeconds(new Date(minutesAgo(11).getTime() - 1), NOW)).toBeNull();
    expect(reopenedCheckoutTimeoutSeconds(minutesAgo(14), NOW)).toBeNull();
    expect(reopenedCheckoutTimeoutSeconds(minutesAgo(40), NOW)).toBeNull();
  });

  it("rounds down, so the checkout never closes later than a minute before the protection ends", () => {
    // 599.5 s of protection left, minus the 60 s margin: 539.5 s.
    expect(reopenedCheckoutTimeoutSeconds(new Date(NOW.getTime() - 300_500), NOW)).toBe(539);
  });

  it("an order stamped slightly in the future counts as brand new, never longer", () => {
    expect(reopenedCheckoutTimeoutSeconds(new Date(NOW.getTime() + 5_000), NOW)).toBe(RAZORPAY_CHECKOUT_TIMEOUT_SECONDS);
  });

  it("reads a time sent as a string", () => {
    expect(reopenedCheckoutTimeoutSeconds(minutesAgo(5).toISOString(), NOW)).toBe(9 * 60);
  });

  it("no order, or an unreadable time, is not reopened", () => {
    expect(reopenedCheckoutTimeoutSeconds(null, NOW)).toBeNull();
    expect(reopenedCheckoutTimeoutSeconds(undefined, NOW)).toBeNull();
    expect(reopenedCheckoutTimeoutSeconds("not a date", NOW)).toBeNull();
  });

  it("the reopened checkout, and the page's own fallback close, end while the hold is still protected", () => {
    const created = minutesAgo(7);
    const keptByCheckout = hold(minutesAgo(8), checkout(created)); // the window closed just before checkout started
    const timeout = reopenedCheckoutTimeoutSeconds(created, NOW);
    expect(timeout).toBe(7 * 60);
    const after = (ms: number) => new Date(NOW.getTime() + ms);
    expect(isHoldLapsed(keptByCheckout, after((timeout ?? 0) * 1000))).toBe(false);
    expect(isHoldLapsed(keptByCheckout, after(checkoutCloseFallbackMs(timeout ?? 0)))).toBe(false);
    expect(isHoldLapsed(keptByCheckout, new Date(created.getTime() + CHECKOUT_GRACE_MS + 1))).toBe(true);
  });
});

describe("openOrderDecision", () => {
  it("reopens an open order with enough protection left, even past the hold's window", () => {
    const created = minutesAgo(6);
    expect(openOrderDecision({ booking: hold(minutesAgo(5), checkout(created)), openOrderCreatedAt: created, now: NOW })).toEqual({
      kind: "REOPEN",
      timeoutSeconds: 8 * 60,
    });
  });

  it("past the window, an order with too little protection left is not reopened and no new order opens", () => {
    const created = minutesAgo(12);
    expect(openOrderDecision({ booking: hold(minutesAgo(5), checkout(created)), openOrderCreatedAt: created, now: NOW })).toEqual({
      kind: "REFUSE",
      refusal: "HOLD_WINDOW_CLOSED",
    });
  });

  it("inside the window, an order with too little protection left is replaced by a new one", () => {
    const created = minutesAgo(12);
    expect(openOrderDecision({ booking: hold(hoursAhead(2), checkout(created)), openOrderCreatedAt: created, now: NOW })).toEqual({
      kind: "NEW_ORDER",
    });
  });

  it("past the window with money that doesn't rely on a checkout, a new order may open", () => {
    const partPaid: HoldFacts = {
      status: "HOLD",
      holdExpiresAt: hoursAgo(2),
      invoices: [unpaid, { status: "PARTIALLY_PAID", paidAmount: 10000, payments: [] }],
    };
    expect(openOrderDecision({ booking: partPaid, openOrderCreatedAt: minutesAgo(13), now: NOW })).toEqual({ kind: "NEW_ORDER" });
  });

  it("with no open order, the hold rule alone decides", () => {
    expect(openOrderDecision({ booking: hold(hoursAhead(2)), openOrderCreatedAt: null, now: NOW })).toEqual({ kind: "NEW_ORDER" });
    expect(openOrderDecision({ booking: hold(minutesAgo(5), checkout(minutesAgo(3))), openOrderCreatedAt: null, now: NOW })).toEqual({
      kind: "REFUSE",
      refusal: "HOLD_WINDOW_CLOSED",
    });
  });

  it("a lapsed hold is refused first, whatever order is open", () => {
    expect(openOrderDecision({ booking: hold(hoursAgo(2)), openOrderCreatedAt: NOW, now: NOW })).toEqual({
      kind: "REFUSE",
      refusal: "HOLD_LAPSED",
    });
  });

  it("a booking that isn't a hold, or no booking, gets a new order once the open one is too old", () => {
    const confirmed: HoldFacts = { status: "CONFIRMED", holdExpiresAt: hoursAgo(48), invoices: [unpaid] };
    expect(openOrderDecision({ booking: confirmed, openOrderCreatedAt: minutesAgo(13), now: NOW })).toEqual({ kind: "NEW_ORDER" });
    expect(openOrderDecision({ booking: null, openOrderCreatedAt: minutesAgo(13), now: NOW })).toEqual({ kind: "NEW_ORDER" });
    expect(openOrderDecision({ booking: confirmed, openOrderCreatedAt: minutesAgo(2), now: NOW })).toEqual({
      kind: "REOPEN",
      timeoutSeconds: 12 * 60,
    });
  });
});
