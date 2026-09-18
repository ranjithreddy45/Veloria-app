import { describe, it, expect } from "vitest";
import {
  splitPageState,
  splitStateCopy,
  type SplitCopyContext,
  type SplitInvoiceFacts,
  type SplitPageState,
} from "./split-page-state";
import type { HoldFacts, HoldInvoiceFacts } from "@/lib/holds/lapsed-hold";

// ============================================================
// /pay/split/<token> tells the payer why a share can't be paid. It used to say
// "Nothing left to pay, already settled" for every unpayable invoice, including
// a cancelled booking and a lapsed hold.
// ============================================================

const NOW = new Date("2026-09-16T10:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000);
const hoursAhead = (h: number) => new Date(NOW.getTime() + h * 60 * 60 * 1000);
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60 * 1000);

type Split = Parameters<typeof splitPageState>[0];
const share = (over: Partial<Split> = {}): Split => ({
  status: "PENDING",
  invoicePayable: true,
  exceedsOutstanding: false,
  outstandingPaise: 500_000,
  ...over,
});
const unpaid: HoldInvoiceFacts = { status: "SENT", paidAmount: 0, payments: [] };
const facts = (invoiceStatus: string, booking: HoldFacts | null): SplitInvoiceFacts => ({ invoiceStatus, booking });

const confirmed: HoldFacts = { status: "CONFIRMED", holdExpiresAt: null, invoices: [unpaid] };
const cancelled: HoldFacts = { status: "CANCELLED", holdExpiresAt: hoursAgo(30), invoices: [unpaid] };
const heldInWindow: HoldFacts = { status: "HOLD", holdExpiresAt: hoursAhead(5), invoices: [unpaid] };
const lapsed: HoldFacts = { status: "HOLD", holdExpiresAt: hoursAgo(2), invoices: [unpaid] };
const pastWindowCheckoutInFlight: HoldFacts = {
  status: "HOLD",
  holdExpiresAt: minutesAgo(5),
  invoices: [{ status: "SENT", paidAmount: 0, payments: [{ status: "PENDING", receiptUploadedAt: null, createdAt: minutesAgo(3) }] }],
};

const CASES: { name: string; split: Split; facts: SplitInvoiceFacts | null; state: SplitPageState }[] = [
  { name: "a cancelled booking is not 'settled'", split: share({ invoicePayable: false }), facts: facts("SENT", cancelled), state: "BOOKING_CANCELLED" },
  { name: "a cancelled booking whose invoice was cancelled too", split: share({ invoicePayable: false }), facts: facts("CANCELLED", cancelled), state: "BOOKING_CANCELLED" },
  { name: "a lapsed hold, though the link still reads payable", split: share(), facts: facts("SENT", lapsed), state: "HOLD_LAPSED" },
  { name: "a lapsed hold on an expired link (the booking's state first)", split: share({ status: "EXPIRED" }), facts: facts("SENT", lapsed), state: "HOLD_LAPSED" },
  { name: "a cancelled booking on an expired link", split: share({ status: "EXPIRED", invoicePayable: false }), facts: facts("SENT", cancelled), state: "BOOKING_CANCELLED" },
  { name: "a paid share, even on a booking cancelled since", split: share({ status: "PAID", invoicePayable: false }), facts: facts("PAID", cancelled), state: "SHARE_PAID" },
  { name: "an expired link on a live booking", split: share({ status: "EXPIRED" }), facts: facts("SENT", confirmed), state: "LINK_EXPIRED" },
  { name: "a withdrawn share", split: share({ status: "CANCELLED" }), facts: facts("SENT", confirmed), state: "LINK_CANCELLED" },
  { name: "a paid invoice", split: share({ invoicePayable: false, outstandingPaise: 0 }), facts: facts("PAID", confirmed), state: "SETTLED" },
  { name: "an owed invoice with nothing outstanding", split: share({ invoicePayable: false, outstandingPaise: 0 }), facts: facts("PARTIALLY_PAID", confirmed), state: "SETTLED" },
  { name: "a draft invoice", split: share({ invoicePayable: false }), facts: facts("DRAFT", confirmed), state: "NOT_OPEN" },
  { name: "a refunded invoice", split: share({ invoicePayable: false }), facts: facts("REFUNDED", confirmed), state: "NOT_OPEN" },
  { name: "a cancelled invoice on a live booking", split: share({ invoicePayable: false }), facts: facts("CANCELLED", confirmed), state: "NOT_OPEN" },
  { name: "facts that couldn't be read never claim 'settled'", split: share({ invoicePayable: false, outstandingPaise: 0 }), facts: null, state: "NOT_OPEN" },
  { name: "facts that couldn't be read fall back on the link's payable check", split: share(), facts: null, state: "PAYABLE" },
  { name: "a share larger than what is owed", split: share({ exceedsOutstanding: true, outstandingPaise: 100_000 }), facts: facts("PARTIALLY_PAID", confirmed), state: "EXCEEDS_OUTSTANDING" },
  { name: "a confirmed booking", split: share(), facts: facts("SENT", confirmed), state: "PAYABLE" },
  { name: "a hold inside its window", split: share(), facts: facts("SENT", heldInWindow), state: "PAYABLE" },
  { name: "a hold past its window with a checkout in flight (the order action decides)", split: share(), facts: facts("SENT", pastWindowCheckoutInFlight), state: "PAYABLE" },
  { name: "an invoice with no booking", split: share(), facts: facts("OVERDUE", null), state: "PAYABLE" },
];

describe("splitPageState", () => {
  for (const c of CASES) {
    it(`${c.state}: ${c.name}`, () => {
      expect(splitPageState(c.split, c.facts, NOW)).toBe(c.state);
    });
  }
});

const ctx: SplitCopyContext = {
  hostFirst: "Priya",
  share: "₹5,000",
  paidOn: "12 September 2026",
  outstanding: "₹1,000",
  invoiceStatus: "SENT",
  bookingCancelled: false,
};

const UNPAYABLE: Exclude<SplitPageState, "PAYABLE">[] = [
  "SHARE_PAID",
  "BOOKING_CANCELLED",
  "HOLD_LAPSED",
  "LINK_EXPIRED",
  "LINK_CANCELLED",
  "SETTLED",
  "NOT_OPEN",
  "EXCEEDS_OUTSTANDING",
];

describe("splitStateCopy", () => {
  it("only a settled invoice says there is nothing left to pay", () => {
    for (const state of UNPAYABLE) {
      const { title, body } = splitStateCopy(state, ctx);
      expect(/nothing left to pay|already been settled/i.test(`${title} ${body}`), state).toBe(state === "SETTLED");
    }
  });

  it("a cancelled booking says the booking is cancelled and the date isn't reserved", () => {
    const c = splitStateCopy("BOOKING_CANCELLED", ctx);
    expect(c.title).toBe("This booking has been cancelled");
    expect(c.body).toMatch(/no longer reserved/);
    expect(c.body).toMatch(/contact Priya or us/);
  });

  it("a lapsed hold says the date is no longer reserved and asks the host to start again", () => {
    const c = splitStateCopy("HOLD_LAPSED", ctx);
    expect(c.title).toMatch(/lapsed/);
    expect(c.body).toMatch(/no longer reserved/);
    expect(c.body).toContain("Please ask Priya to start again.");
  });

  it("an invoice not open for payment names its status in the customer's words, never the raw value", () => {
    const refunded = splitStateCopy("NOT_OPEN", { ...ctx, invoiceStatus: "REFUNDED" });
    expect(refunded.body).toContain('"Refunded"');
    expect(refunded.body).not.toContain("REFUNDED");
    expect(splitStateCopy("NOT_OPEN", { ...ctx, invoiceStatus: null }).body).toMatch(/nothing can be paid on this link right now/i);
  });

  it("a paid share on a booking that is now cancelled says so", () => {
    expect(splitStateCopy("SHARE_PAID", ctx).body).not.toMatch(/cancelled/);
    expect(splitStateCopy("SHARE_PAID", { ...ctx, bookingCancelled: true }).body).toMatch(/booking is now cancelled/);
  });

  it("starts a sentence with a capital when the host's name is unknown", () => {
    expect(splitStateCopy("LINK_CANCELLED", { ...ctx, hostFirst: "the host" }).body.startsWith("The host withdrew")).toBe(true);
  });
});
