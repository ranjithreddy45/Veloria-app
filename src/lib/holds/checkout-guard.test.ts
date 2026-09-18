import { describe, it, expect } from "vitest";
import { newCheckoutWouldExtendHold } from "./checkout-guard";
import {
  CHECKOUT_GRACE_MS,
  isHoldLapsed,
  type HoldFacts,
  type HoldInvoiceFacts,
  type HoldPaymentFacts,
} from "./lapsed-hold";

// ============================================================
// Starting a NEW checkout must not keep an expired hold alive. Every Razorpay
// order starts a 15-minute grace that protects a hold from lapsing; if a new
// order could still be opened after the window closed, reopening checkout would
// hold the date forever. The lapsed-hold rule itself is unchanged.
// ============================================================

const NOW = new Date("2026-09-16T10:00:00.000Z");
const EXPIRED = new Date("2026-09-16T09:55:00.000Z"); // the window closed 5 minutes ago
const OPEN_WINDOW = new Date("2026-09-16T13:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60 * 1000);

const unpaid: HoldInvoiceFacts = { status: "SENT", paidAmount: 0, payments: [] };
const invoiceWith = (...payments: HoldPaymentFacts[]): HoldInvoiceFacts => ({ status: "SENT", paidAmount: 0, payments });
const checkoutStarted = (m: number): HoldPaymentFacts => ({ status: "PENDING", receiptUploadedAt: null, createdAt: minutesAgo(m) });

const CASES: { name: string; b: HoldFacts; refuse: boolean }[] = [
  { name: "inside its window, nothing paid", b: { status: "HOLD", holdExpiresAt: OPEN_WINDOW, invoices: [unpaid] }, refuse: false },
  {
    name: "inside its window, a checkout already open",
    b: { status: "HOLD", holdExpiresAt: OPEN_WINDOW, invoices: [invoiceWith(checkoutStarted(1))] },
    refuse: false,
  },
  { name: "past its window with nothing paid (lapsed)", b: { status: "HOLD", holdExpiresAt: EXPIRED, invoices: [unpaid] }, refuse: true },
  {
    name: "past its window, kept alive only by a checkout started before it closed",
    b: { status: "HOLD", holdExpiresAt: EXPIRED, invoices: [invoiceWith(checkoutStarted(8))] },
    refuse: true,
  },
  {
    name: "past its window, kept alive only by a checkout started after it closed",
    b: { status: "HOLD", holdExpiresAt: EXPIRED, invoices: [invoiceWith(checkoutStarted(2))] },
    refuse: true,
  },
  {
    name: "past its window with money on another invoice",
    b: { status: "HOLD", holdExpiresAt: EXPIRED, invoices: [unpaid, { status: "PARTIALLY_PAID", paidAmount: 10000, payments: [] }] },
    refuse: false,
  },
  {
    name: "past its window with an invoice marked PAID",
    b: { status: "HOLD", holdExpiresAt: EXPIRED, invoices: [{ status: "PAID", paidAmount: 0, payments: [] }] },
    refuse: false,
  },
  {
    name: "past its window with a completed payment not yet credited",
    b: { status: "HOLD", holdExpiresAt: EXPIRED, invoices: [invoiceWith({ status: "COMPLETED", createdAt: minutesAgo(30) })] },
    refuse: false,
  },
  {
    name: "past its window with a payment processing at the gateway",
    b: { status: "HOLD", holdExpiresAt: EXPIRED, invoices: [invoiceWith({ status: "PROCESSING", createdAt: minutesAgo(30) })] },
    refuse: false,
  },
  {
    name: "past its window with a payment proof awaiting verification",
    b: {
      status: "HOLD",
      holdExpiresAt: EXPIRED,
      invoices: [invoiceWith({ status: "PENDING", receiptUploadedAt: minutesAgo(40), createdAt: minutesAgo(40) })],
    },
    refuse: false,
  },
  { name: "a confirmed booking", b: { status: "CONFIRMED", holdExpiresAt: EXPIRED, invoices: [unpaid] }, refuse: false },
  { name: "a hold with no window", b: { status: "HOLD", holdExpiresAt: null, invoices: [unpaid] }, refuse: false },
];

describe("newCheckoutWouldExtendHold", () => {
  for (const c of CASES) {
    it(`${c.refuse ? "refuses" : "allows"} a new checkout: ${c.name}`, () => {
      expect(newCheckoutWouldExtendHold(c.b, NOW)).toBe(c.refuse);
    });
  }

  it("refuses every lapsed hold", () => {
    for (const c of CASES) {
      if (isHoldLapsed(c.b, NOW)) expect(newCheckoutWouldExtendHold(c.b, NOW)).toBe(true);
    }
  });
});

describe("a checkout started before expiry protects the hold for its own grace only", () => {
  const protectedByCheckout: HoldFacts = { status: "HOLD", holdExpiresAt: EXPIRED, invoices: [invoiceWith(checkoutStarted(8))] };

  it("while that checkout is in its grace the hold has not lapsed, but no new checkout may start", () => {
    expect(isHoldLapsed(protectedByCheckout, NOW)).toBe(false);
    expect(newCheckoutWouldExtendHold(protectedByCheckout, NOW)).toBe(true);
  });

  it("when that grace ends the hold lapses, since no later order could renew it", () => {
    const afterGrace = new Date(minutesAgo(8).getTime() + CHECKOUT_GRACE_MS + 1000);
    expect(isHoldLapsed(protectedByCheckout, afterGrace)).toBe(true);
  });
});
