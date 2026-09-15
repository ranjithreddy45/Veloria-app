import { describe, it, expect } from "vitest";
import {
  CANCELLED_BOOKING_CHECKOUT_ERROR,
  CUSTOMER_HOLD_CHECKOUT_ERROR,
  HOLD_LAPSED_CHECKOUT_ERROR,
  HOLD_WINDOW_CLOSED_CHECKOUT_ERROR,
  STAFF_HOLD_CHECKOUT_ERROR,
  bookingIsCancelled,
  holdCheckoutRefusal,
  newCheckoutWouldExtendHold,
  type HoldCheckoutRefusal,
} from "./checkout-guard";
import { EXTEND_HOLD_LABEL } from "./hold-extension";
import { isHoldLapsed, type HoldFacts, type HoldInvoiceFacts, type HoldPaymentFacts } from "./lapsed-hold";

// ============================================================
// holdCheckoutRefusal is the one decision the portal's order route and the
// team's createRazorpayOrder share with the public pay links: a lapsed hold is
// refused, then a hold past its window whose only protection is a checkout
// already started. Customers get the pay links' words; the team is told to
// extend the hold or start a new one.
// ============================================================

const NOW = new Date("2026-09-16T10:00:00.000Z");
const EXPIRED = new Date("2026-09-16T09:55:00.000Z");
const OPEN_WINDOW = new Date("2026-09-16T13:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60 * 1000);

const unpaid: HoldInvoiceFacts = { status: "SENT", paidAmount: 0, payments: [] };
const invoiceWith = (...payments: HoldPaymentFacts[]): HoldInvoiceFacts => ({ status: "SENT", paidAmount: 0, payments });
const checkoutStarted = (m: number): HoldPaymentFacts => ({ status: "PENDING", receiptUploadedAt: null, createdAt: minutesAgo(m) });

const CASES: { name: string; b: HoldFacts | null; refusal: HoldCheckoutRefusal | null }[] = [
  { name: "no booking", b: null, refusal: null },
  { name: "a hold inside its window", b: { status: "HOLD", holdExpiresAt: OPEN_WINDOW, invoices: [unpaid] }, refusal: null },
  {
    name: "a hold inside its window with a checkout open",
    b: { status: "HOLD", holdExpiresAt: OPEN_WINDOW, invoices: [invoiceWith(checkoutStarted(2))] },
    refusal: null,
  },
  { name: "a lapsed hold", b: { status: "HOLD", holdExpiresAt: EXPIRED, invoices: [unpaid] }, refusal: "HOLD_LAPSED" },
  {
    name: "a hold past its window kept only by a checkout in its grace",
    b: { status: "HOLD", holdExpiresAt: EXPIRED, invoices: [invoiceWith(checkoutStarted(3))] },
    refusal: "HOLD_WINDOW_CLOSED",
  },
  {
    name: "a hold past its window with money on another invoice",
    b: { status: "HOLD", holdExpiresAt: EXPIRED, invoices: [unpaid, { status: "PARTIALLY_PAID", paidAmount: 5000, payments: [] }] },
    refusal: null,
  },
  {
    name: "a hold past its window with a proof awaiting verification",
    b: {
      status: "HOLD",
      holdExpiresAt: EXPIRED,
      invoices: [invoiceWith({ status: "PENDING", receiptUploadedAt: minutesAgo(90), createdAt: minutesAgo(90) })],
    },
    refusal: null,
  },
  { name: "a confirmed booking", b: { status: "CONFIRMED", holdExpiresAt: EXPIRED, invoices: [unpaid] }, refusal: null },
  { name: "a hold with no window", b: { status: "HOLD", holdExpiresAt: null, invoices: [unpaid] }, refusal: null },
];

describe("holdCheckoutRefusal", () => {
  for (const c of CASES) {
    it(`${c.refusal ?? "allows a new checkout"}: ${c.name}`, () => {
      expect(holdCheckoutRefusal(c.b, NOW)).toBe(c.refusal);
    });
  }

  it("is exactly the public pay links' two checks, lapsed first", () => {
    for (const c of CASES) {
      if (!c.b) continue;
      const expected = isHoldLapsed(c.b, NOW) ? "HOLD_LAPSED" : newCheckoutWouldExtendHold(c.b, NOW) ? "HOLD_WINDOW_CLOSED" : null;
      expect(holdCheckoutRefusal(c.b, NOW)).toBe(expected);
    }
  });
});

describe("the words", () => {
  it("customers get the public pay links' words", () => {
    expect(CUSTOMER_HOLD_CHECKOUT_ERROR.HOLD_LAPSED).toBe(HOLD_LAPSED_CHECKOUT_ERROR);
    expect(CUSTOMER_HOLD_CHECKOUT_ERROR.HOLD_WINDOW_CLOSED).toBe(HOLD_WINDOW_CLOSED_CHECKOUT_ERROR);
  });

  it("the team is told to extend the hold or start a new one", () => {
    for (const message of Object.values(STAFF_HOLD_CHECKOUT_ERROR)) {
      expect(message).toMatch(/extend the hold/i);
      expect(message).toMatch(/start a new one/i);
    }
  });

  it("the team is pointed to the Extend hold item on the booking page", () => {
    for (const message of Object.values(STAFF_HOLD_CHECKOUT_ERROR)) {
      expect(message).toContain(EXTEND_HOLD_LABEL);
      expect(message).toMatch(/booking page/i);
    }
  });
});

describe("a cancelled booking", () => {
  it("is refused in the invoice link's words, which the portal uses too", () => {
    expect(CANCELLED_BOOKING_CHECKOUT_ERROR).toBe(
      "This booking has been cancelled, so the date is no longer reserved and it can't be paid online. Please contact us to book again."
    );
  });

  it("is read from the booking's status alone", () => {
    expect(bookingIsCancelled({ status: "CANCELLED" })).toBe(true);
    for (const status of ["HOLD", "TENTATIVE", "CONFIRMED", "IN_PROGRESS", "COMPLETED"]) {
      expect(bookingIsCancelled({ status })).toBe(false);
    }
    expect(bookingIsCancelled(null)).toBe(false);
    expect(bookingIsCancelled(undefined)).toBe(false);
  });
});
