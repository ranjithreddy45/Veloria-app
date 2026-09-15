import { describe, it, expect } from "vitest";
import {
  computeEventProfitability,
  summarizeEventProfitability,
  estimateStaffCost,
  hoursBetween,
  type EventProfitabilityInput,
} from "./event-profitability";

const booking = {
  bookingId: "b1",
  bookingNumber: "BK-001",
  eventName: "Sharma Wedding",
  eventType: "Wedding",
  bookingStatus: "CONFIRMED",
  date: "2026-09-12T00:00:00.000Z",
  venueId: "v1",
  venueName: "Grand Hall",
  customer: "Ravi Sharma",
  contractValue: 1500000,
};

const noVendor = {
  approvedBillTotal: 0,
  paidPayoutTotal: 0,
  approvedUnlinkedPayoutNet: 0,
  paidUnlinkedPayoutNet: 0,
  pendingPayoutTotal: 0,
  agreedRateTotal: 0,
  recordCount: 0,
};
const noOther = { committed: 0, paid: 0, pending: 0, recordCount: 0 };

function input(over: Partial<EventProfitabilityInput> = {}): EventProfitabilityInput {
  return {
    booking,
    revenue: { invoicedIssued: 1770000, issuedInvoiceCount: 1, paymentsCompleted: 1000000, paymentsRefunded: 0, balanceDue: 770000 },
    vendor: { ...noVendor },
    other: { ...noOther },
    staff: [],
    ...over,
  };
}

describe("computeEventProfitability — revenue definitions", () => {
  it("takes balance due from the owed invoices, not invoiced − collected", () => {
    // A ₹5,00,000 invoice paid, then fully refunded (REFUNDED: billed, not owed), and a
    // ₹10,00,000 invoice with ₹6,00,000 collected (PARTIALLY_PAID: ₹4,00,000 owed).
    const row = computeEventProfitability(
      input({
        revenue: { invoicedIssued: 1500000, issuedInvoiceCount: 2, paymentsCompleted: 600000, paymentsRefunded: 500000, balanceDue: 400000 },
      }),
    );
    expect(row.invoiced).toBe(1500000);
    expect(row.collected).toBe(600000);
    expect(row.refunded).toBe(500000);
    expect(row.balanceDue).toBe(400000); // not 15,00,000 − 6,00,000
    expect(row.flags).toEqual(expect.arrayContaining(["BALANCE_DUE", "REFUNDED"]));
  });

  it("owes nothing on a booking whose only invoice was fully refunded", () => {
    const row = computeEventProfitability(
      input({
        revenue: { invoicedIssued: 500000, issuedInvoiceCount: 1, paymentsCompleted: 0, paymentsRefunded: 500000, balanceDue: 0 },
      }),
    );
    expect(row.invoiced).toBe(500000);
    expect(row.balanceDue).toBe(0);
    expect(row.flags).toContain("REFUNDED");
    expect(row.flags).not.toContain("BALANCE_DUE");
    expect(row.flags).not.toContain("NO_INVOICE");
  });

  it("carries invoiced (accrual) and collected (cash) separately and nets refunds", () => {
    // A refunded payment reopens its invoice, so the ₹2,00,000 refunded is owed again.
    const row = computeEventProfitability(
      input({
        revenue: { invoicedIssued: 1770000, issuedInvoiceCount: 2, paymentsCompleted: 800000, paymentsRefunded: 200000, balanceDue: 970000 },
        vendor: { ...noVendor, paidPayoutTotal: 100000, paidUnlinkedPayoutNet: 100000, recordCount: 1 },
      }),
    );
    expect(row.invoiced).toBe(1770000);
    expect(row.collected).toBe(800000); // COMPLETED only — a refunded payment is no longer completed
    expect(row.collectedGross).toBe(1000000);
    expect(row.refunded).toBe(200000);
    expect(row.balanceDue).toBe(970000);
    expect(row.flags).toContain("REFUNDED");
    expect(row.flags).toContain("BALANCE_DUE");
    expect(row.contractValue).toBe(1500000); // reference only
  });

  it("flags a booking with no issued invoice", () => {
    const row = computeEventProfitability(
      input({ revenue: { invoicedIssued: 0, issuedInvoiceCount: 0, paymentsCompleted: 0, paymentsRefunded: 0, balanceDue: 0 } }),
    );
    expect(row.flags).toContain("NO_INVOICE");
    expect(row.dataStatus).toBe("no-revenue");
    expect(row.grossMargin).toBeNull();
  });
});

describe("computeEventProfitability — vendor cost (committed vs paid)", () => {
  it("does not double count a payout linked to an approved bill", () => {
    // Bill ₹1,00,000 approved; ₹60,000 paid against it (linked); nothing unlinked.
    const row = computeEventProfitability(
      input({
        vendor: {
          approvedBillTotal: 100000,
          paidPayoutTotal: 60000,
          approvedUnlinkedPayoutNet: 0,
          paidUnlinkedPayoutNet: 0,
          pendingPayoutTotal: 0,
          agreedRateTotal: 100000,
          recordCount: 2,
        },
      }),
    );
    expect(row.vendorCommitted).toBe(100000);
    expect(row.vendorPaid).toBe(60000);
    expect(row.flags).toContain("COSTS_UNPAID");
    expect(row.flags).not.toContain("VENDOR_UNBILLED");
    expect(row.grossMargin).toBe(940000); // 10,00,000 − 60,000 paid
    expect(row.committedMargin).toBe(900000); // 10,00,000 − 1,00,000 committed
    expect(row.marginPct).toBe(94);
    expect(row.dataStatus).toBe("partial");
  });

  it("counts a netted advance once — inside the bill, not again as an unlinked payout", () => {
    // ₹20,000 advance PAID (unlinked), fully netted into a ₹1,00,000 approved bill,
    // then ₹80,000 PAID linked to the bill.
    const row = computeEventProfitability(
      input({
        vendor: {
          approvedBillTotal: 100000,
          paidPayoutTotal: 100000, // 20,000 advance + 80,000 linked
          approvedUnlinkedPayoutNet: 0,
          paidUnlinkedPayoutNet: 0, // 20,000 − 20,000 netted
          pendingPayoutTotal: 0,
          agreedRateTotal: 0,
          recordCount: 3,
        },
      }),
    );
    expect(row.vendorCommitted).toBe(100000);
    expect(row.vendorPaid).toBe(100000);
    expect(row.flags).not.toContain("COSTS_UNPAID");
  });

  it("treats an unlinked paid payout with no bill as both committed and paid", () => {
    const row = computeEventProfitability(
      input({ vendor: { ...noVendor, paidPayoutTotal: 50000, paidUnlinkedPayoutNet: 50000, recordCount: 1 } }),
    );
    expect(row.vendorCommitted).toBe(50000);
    expect(row.vendorPaid).toBe(50000);
    expect(row.grossMargin).toBe(950000);
    expect(row.dataStatus).toBe("partial"); // balance still due on the invoice
  });

  it("never reports committed below paid", () => {
    const row = computeEventProfitability(
      input({ vendor: { ...noVendor, approvedBillTotal: 40000, paidPayoutTotal: 50000, recordCount: 2 } }),
    );
    expect(row.vendorCommitted).toBe(50000);
  });

  it("flags agreed-but-unbilled vendors and pending-only payouts as missing cost data", () => {
    const row = computeEventProfitability(
      input({ vendor: { ...noVendor, agreedRateTotal: 250000, pendingPayoutTotal: 50000, recordCount: 0 } }),
    );
    expect(row.hasCostData).toBe(false);
    expect(row.grossMargin).toBeNull();
    expect(row.marginPct).toBeNull();
    expect(row.pendingCost).toBe(50000);
    expect(row.flags).toEqual(expect.arrayContaining(["NO_COST_DATA", "COSTS_PENDING_APPROVAL", "VENDOR_UNBILLED"]));
    expect(row.dataStatus).toBe("no-cost-data");
  });
});

describe("computeEventProfitability — other cost, staff, margin", () => {
  it("adds commission/owner/referral paid cost into the margin and keeps committed separate", () => {
    const row = computeEventProfitability(
      input({
        revenue: { invoicedIssued: 1000000, issuedInvoiceCount: 1, paymentsCompleted: 1000000, paymentsRefunded: 0, balanceDue: 0 },
        vendor: { ...noVendor, paidPayoutTotal: 300000, paidUnlinkedPayoutNet: 300000, recordCount: 1 },
        other: { committed: 20000, paid: 75000, pending: 30000, recordCount: 2 },
      }),
    );
    expect(row.otherPaid).toBe(75000);
    expect(row.otherCommitted).toBe(95000);
    expect(row.paidCost).toBe(375000);
    expect(row.committedCost).toBe(395000);
    expect(row.grossMargin).toBe(625000);
    expect(row.marginPct).toBe(62.5);
    expect(row.pendingCost).toBe(30000);
    expect(row.flags).toContain("COSTS_PENDING_APPROVAL");
    expect(row.flags).toContain("COSTS_UNPAID");
  });

  it("is complete when invoiced = collected and every committed cost is paid", () => {
    const row = computeEventProfitability(
      input({
        revenue: { invoicedIssued: 1000000, issuedInvoiceCount: 1, paymentsCompleted: 1000000, paymentsRefunded: 0, balanceDue: 0 },
        vendor: { ...noVendor, approvedBillTotal: 400000, paidPayoutTotal: 400000, recordCount: 2 },
        other: { committed: 0, paid: 50000, pending: 0, recordCount: 1 },
      }),
    );
    expect(row.dataStatus).toBe("complete");
    expect(row.flags).toEqual([]);
    expect(row.grossMargin).toBe(550000);
    expect(row.marginPct).toBe(55);
  });

  it("flags a negative margin", () => {
    const row = computeEventProfitability(
      input({
        revenue: { invoicedIssued: 100000, issuedInvoiceCount: 1, paymentsCompleted: 100000, paymentsRefunded: 0, balanceDue: 0 },
        vendor: { ...noVendor, paidPayoutTotal: 150000, paidUnlinkedPayoutNet: 150000, recordCount: 1 },
      }),
    );
    expect(row.grossMargin).toBe(-50000);
    expect(row.marginPct).toBe(-50);
    expect(row.flags).toContain("NEGATIVE_MARGIN");
  });

  it("estimates staff cost from hours × hourly rate and excludes it from margin", () => {
    const row = computeEventProfitability(
      input({
        vendor: { ...noVendor, paidPayoutTotal: 100000, paidUnlinkedPayoutNet: 100000, recordCount: 1 },
        staff: [
          { hours: 8, hourlyRate: 500 },
          { hours: 6, hourlyRate: 350 },
          { hours: 8, hourlyRate: null },
        ],
      }),
    );
    expect(row.staffCost).toBe(6100);
    expect(row.staffHours).toBe(22);
    expect(row.staffAssignmentCount).toBe(3);
    expect(row.staffUnratedCount).toBe(1);
    expect(row.flags).toContain("STAFF_UNRATED");
    expect(row.grossMargin).toBe(900000); // staff estimate NOT subtracted
  });

  it("returns a null staff cost when no assigned staff has a rate", () => {
    expect(estimateStaffCost([{ hours: 8, hourlyRate: null }, { hours: 4, hourlyRate: 0 }])).toEqual({
      cost: null,
      hours: 12,
      assignmentCount: 2,
      unratedCount: 2,
    });
    expect(estimateStaffCost([])).toEqual({ cost: null, hours: 0, assignmentCount: 0, unratedCount: 0 });
  });

  it("is deterministic and ignores negative/NaN inputs", () => {
    const a = computeEventProfitability(
      input({ vendor: { ...noVendor, paidPayoutTotal: -5, paidUnlinkedPayoutNet: Number.NaN, recordCount: 1 } }),
    );
    const b = computeEventProfitability(
      input({ vendor: { ...noVendor, paidPayoutTotal: -5, paidUnlinkedPayoutNet: Number.NaN, recordCount: 1 } }),
    );
    expect(a).toEqual(b);
    expect(a.vendorPaid).toBe(0);
    expect(a.vendorCommitted).toBe(0);
  });
});

describe("hoursBetween", () => {
  it("measures rostered hours and clamps inverted shifts to zero", () => {
    expect(hoursBetween("2026-09-12T04:30:00.000Z", "2026-09-12T12:00:00.000Z")).toBe(7.5);
    expect(hoursBetween(new Date("2026-09-12T12:00:00Z"), new Date("2026-09-12T04:00:00Z"))).toBe(0);
    expect(hoursBetween("garbage", "2026-09-12T12:00:00.000Z")).toBe(0);
  });
});

describe("summarizeEventProfitability", () => {
  it("totals revenue over every row but margin only over costed rows", () => {
    const costed = computeEventProfitability(
      input({
        revenue: { invoicedIssued: 1000000, issuedInvoiceCount: 1, paymentsCompleted: 1000000, paymentsRefunded: 0, balanceDue: 0 },
        vendor: { ...noVendor, paidPayoutTotal: 400000, paidUnlinkedPayoutNet: 400000, recordCount: 1 },
        staff: [{ hours: 10, hourlyRate: 500 }],
      }),
    );
    const uncosted = computeEventProfitability(
      input({
        booking: { ...booking, bookingId: "b2", bookingNumber: "BK-002" },
        revenue: { invoicedIssued: 500000, issuedInvoiceCount: 1, paymentsCompleted: 500000, paymentsRefunded: 0, balanceDue: 0 },
        staff: [{ hours: 10, hourlyRate: null }],
      }),
    );
    const noRevenue = computeEventProfitability(
      input({
        booking: { ...booking, bookingId: "b3", bookingNumber: "BK-003" },
        revenue: { invoicedIssued: 0, issuedInvoiceCount: 0, paymentsCompleted: 0, paymentsRefunded: 0, balanceDue: 0 },
      }),
    );
    const t = summarizeEventProfitability([costed, uncosted, noRevenue]);
    expect(t.bookings).toBe(3);
    expect(t.costedBookings).toBe(1);
    expect(t.noCostDataBookings).toBe(2);
    expect(t.noRevenueBookings).toBe(1);
    expect(t.collected).toBe(1500000); // all rows
    expect(t.invoiced).toBe(1500000);
    expect(t.vendorPaid).toBe(400000);
    expect(t.grossMargin).toBe(600000); // costed row only — the uncosted ₹5L is NOT a 100% margin
    expect(t.costedCollected).toBe(1000000);
    expect(t.avgMarginPct).toBe(60);
    expect(t.staffCost).toBe(5000);
    expect(t.staffEstimatedBookings).toBe(1);
    expect(t.staffUnratedBookings).toBe(1);
  });

  it("weights the average margin by collected cash, not by row", () => {
    const big = computeEventProfitability(
      input({
        revenue: { invoicedIssued: 900000, issuedInvoiceCount: 1, paymentsCompleted: 900000, paymentsRefunded: 0, balanceDue: 0 },
        vendor: { ...noVendor, paidPayoutTotal: 450000, paidUnlinkedPayoutNet: 450000, recordCount: 1 }, // 50%
      }),
    );
    const small = computeEventProfitability(
      input({
        booking: { ...booking, bookingId: "b2" },
        revenue: { invoicedIssued: 100000, issuedInvoiceCount: 1, paymentsCompleted: 100000, paymentsRefunded: 0, balanceDue: 0 },
        vendor: { ...noVendor, paidPayoutTotal: 0, approvedBillTotal: 10000, recordCount: 1 }, // 100% paid-basis
      }),
    );
    const t = summarizeEventProfitability([big, small]);
    expect(t.avgMarginPct).toBe(55); // (450k + 100k) / 1,000k — not the row mean of 75
  });

  it("returns a null average when nothing is costed", () => {
    const t = summarizeEventProfitability([computeEventProfitability(input())]);
    expect(t.avgMarginPct).toBeNull();
    expect(t.grossMargin).toBe(0);
    expect(summarizeEventProfitability([]).bookings).toBe(0);
  });
});
