// ============================================================
// Finance — Event profitability (per-booking gross margin).
// ------------------------------------------------------------
// Pure, deterministic math over PRE-AGGREGATED per-booking figures. The action
// layer (finance-profitability.actions.ts) runs the Prisma groupBy/aggregate
// queries and hands the sums in here; nothing in this file touches a clock, a
// database or a locale, so it unit-tests cleanly.
//
// The app carries three "revenue" numbers (see memory: app-integrity-gotchas
// #4). This report shows exactly TWO of them, side by side and labelled — it
// does not invent a fourth:
//   invoiced  (accrual) = Σ Invoice.totalAmount for ISSUED invoices on the
//                         booking — status ∉ {DRAFT, CANCELLED}. Same basis as
//                         the Finance P&L (income recognised when the invoice
//                         is sent).
//   collected (cash)    = Σ Payment COMPLETED − Σ Payment REFUNDED, reached via
//                         the booking's invoices. Same basis as the Dashboard
//                         "Revenue this month" tile (completed payments). A
//                         refund flips the whole Payment to REFUNDED, so the
//                         net is simply the COMPLETED sum; the gross and the
//                         refunded figure are kept so the row can say so.
//
// Costs (all tied to the booking by bookingId):
//   vendorPaid      = Σ Payout(VENDOR_PAYMENT, PAID) — cash actually out,
//                     advances included (an advance is real cash out).
//   vendorCommitted = Σ VendorBill(APPROVED).amount
//                   + Σ Payout(VENDOR_PAYMENT, APPROVED|PAID, billId = null)
//                       net of what was netted into a bill (amount − nettedAmount).
//                     A payout LINKED to a bill is already inside the bill's
//                     amount, so it is not added again. Never below vendorPaid.
//   otherPaid / otherCommitted = CommissionEntry (PAID / APPROVED+PAID)
//                   + Payout COMMISSION & OWNER_PAYOUT (PAID / APPROVED+PAID)
//                   + ReferralReward rewardType CASH (REWARD_PAID / REWARD_APPROVED+PAID).
//                     POINTS / DISCOUNT rewards are not cash and are excluded.
//   pendingCost     = PENDING payouts/commission entries + REWARD_PENDING/
//                     ELIGIBLE cash rewards. Not yet approved, so NOT counted
//                     as committed — surfaced as a flag instead.
//   staffCost       = Σ assignment hours × StaffProfile.hourlyRate. This is an
//                     ESTIMATE (rate × rostered hours, not payroll) and is null
//                     when no assigned staff member has an hourly rate. It is
//                     shown on its own and never enters gross margin.
//   grossMargin     = collected − (vendorPaid + otherPaid). Null when the
//                     booking has NO approved/paid cost record at all: an
//                     unknown cost is not a 100% margin.
// ============================================================

export interface BookingRef {
  bookingId: string;
  bookingNumber: string;
  eventName: string;
  eventType: string;
  bookingStatus: string;
  /** ISO instant of the @db.Date column (UTC midnight of the event day). */
  date: string;
  venueId: string;
  venueName: string;
  customer: string;
  /** Booking.totalAmount — the CONTRACTED figure (the third revenue definition).
   * Carried for reference/CSV only; never used in the margin math. */
  contractValue: number;
}

export interface RevenueInput {
  /** Σ Invoice.totalAmount, status ∉ {DRAFT, CANCELLED}. */
  invoicedIssued: number;
  issuedInvoiceCount: number;
  /** Σ Payment.amount, status COMPLETED. */
  paymentsCompleted: number;
  /** Σ Payment.amount, status REFUNDED (was collected, then returned). */
  paymentsRefunded: number;
}

export interface VendorCostInput {
  /** Σ VendorBill.amount, status APPROVED. */
  approvedBillTotal: number;
  /** Σ Payout(VENDOR_PAYMENT, PAID).amount — linked or not. */
  paidPayoutTotal: number;
  /** Σ (amount − nettedAmount) over Payout(VENDOR_PAYMENT, APPROVED, billId null). */
  approvedUnlinkedPayoutNet: number;
  /** Σ (amount − nettedAmount) over Payout(VENDOR_PAYMENT, PAID, billId null). */
  paidUnlinkedPayoutNet: number;
  /** Σ Payout(VENDOR_PAYMENT, PENDING).amount — awaiting approval. */
  pendingPayoutTotal: number;
  /** Σ BookingVendor.agreedRate — the pre-bill agreement. */
  agreedRateTotal: number;
  /** Approved bills + APPROVED/PAID vendor payouts. 0 ⇒ no vendor cost data. */
  recordCount: number;
}

export interface OtherCostInput {
  /** Approved but not yet paid (commission entries, commission/owner payouts, cash rewards). */
  committed: number;
  /** Paid (same sources). */
  paid: number;
  /** Awaiting approval (same sources). Excluded from committed. */
  pending: number;
  /** Approved + paid records. 0 ⇒ no other-cost data. */
  recordCount: number;
}

export interface StaffAssignmentInput {
  hours: number;
  /** StaffProfile.hourlyRate for the assigned user; null when the user has no
   * profile or no hourly rate (a monthly-only salary is deliberately NOT
   * spread onto events — that would be an assumption, not a rate). */
  hourlyRate: number | null;
}

export interface EventProfitabilityInput {
  booking: BookingRef;
  revenue: RevenueInput;
  vendor: VendorCostInput;
  other: OtherCostInput;
  staff: StaffAssignmentInput[];
}

export type ProfitabilityFlag =
  | "NO_INVOICE" // nothing issued yet
  | "BALANCE_DUE" // invoiced > collected
  | "REFUNDED" // some cash went back
  | "NO_COST_DATA" // no approved/paid bill, payout, commission or cash reward
  | "COSTS_PENDING_APPROVAL" // cost records exist but none is approved yet
  | "VENDOR_UNBILLED" // vendors agreed a rate but nothing is billed/paid
  | "COSTS_UNPAID" // committed > paid — margin will fall as bills settle
  | "STAFF_UNRATED" // assigned staff without an hourly rate
  | "NEGATIVE_MARGIN";

export type DataStatus = "complete" | "partial" | "no-cost-data" | "no-revenue";

export const FLAG_LABEL: Record<ProfitabilityFlag, string> = {
  NO_INVOICE: "No invoice issued",
  BALANCE_DUE: "Balance still due",
  REFUNDED: "Has refunds",
  NO_COST_DATA: "No approved cost data",
  COSTS_PENDING_APPROVAL: "Costs pending approval",
  VENDOR_UNBILLED: "Vendor agreed, not billed",
  COSTS_UNPAID: "Committed costs unpaid",
  STAFF_UNRATED: "Staff without hourly rate",
  NEGATIVE_MARGIN: "Negative margin",
};

export interface EventProfitabilityRow extends BookingRef {
  invoiced: number;
  /** Net cash: completed − refunded. */
  collected: number;
  collectedGross: number;
  refunded: number;
  balanceDue: number;
  vendorPaid: number;
  vendorCommitted: number;
  vendorAgreed: number;
  otherPaid: number;
  otherCommitted: number;
  pendingCost: number;
  paidCost: number;
  committedCost: number;
  /** Estimate; null when not estimable (see STAFF_UNRATED / staffAssignmentCount). */
  staffCost: number | null;
  staffHours: number;
  staffAssignmentCount: number;
  staffUnratedCount: number;
  grossMargin: number | null;
  marginPct: number | null;
  /** collected − committedCost — where margin lands once approved bills settle. */
  committedMargin: number | null;
  hasCostData: boolean;
  dataStatus: DataStatus;
  flags: ProfitabilityFlag[];
}

export interface EventProfitabilityTotals {
  bookings: number;
  costedBookings: number;
  noCostDataBookings: number;
  noRevenueBookings: number;
  contractValue: number;
  invoiced: number;
  collected: number;
  refunded: number;
  vendorPaid: number;
  vendorCommitted: number;
  otherPaid: number;
  otherCommitted: number;
  pendingCost: number;
  paidCost: number;
  committedCost: number;
  /** Σ grossMargin over COSTED bookings only. */
  grossMargin: number;
  /** Σ collected over costed bookings — the margin-% denominator. */
  costedCollected: number;
  /** Collected-weighted margin % over costed bookings; null when none. */
  avgMarginPct: number | null;
  staffCost: number;
  staffEstimatedBookings: number;
  staffUnratedBookings: number;
}

const r2 = (n: number): number => Math.round(n * 100) / 100;
const pos = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);
const EPS = 0.005;

/** Whole hours (2dp) between two instants; never negative. */
export function hoursBetween(start: Date | string, end: Date | string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 0;
  return r2((e - s) / 3_600_000);
}

export interface StaffCostEstimate {
  cost: number | null;
  hours: number;
  assignmentCount: number;
  unratedCount: number;
}

/** Rate × rostered hours per assignment. Null cost when nothing is rated. */
export function estimateStaffCost(assignments: StaffAssignmentInput[]): StaffCostEstimate {
  let cost = 0;
  let hours = 0;
  let rated = 0;
  let unrated = 0;
  for (const a of assignments) {
    const h = pos(a.hours);
    hours += h;
    if (a.hourlyRate != null && Number.isFinite(a.hourlyRate) && a.hourlyRate > 0) {
      rated += 1;
      cost += h * a.hourlyRate;
    } else {
      unrated += 1;
    }
  }
  return {
    cost: rated > 0 ? r2(cost) : null,
    hours: r2(hours),
    assignmentCount: assignments.length,
    unratedCount: unrated,
  };
}

export function computeEventProfitability(input: EventProfitabilityInput): EventProfitabilityRow {
  const { booking, revenue, vendor, other } = input;

  // ---- revenue (two labelled definitions) ----
  const invoiced = r2(pos(revenue.invoicedIssued));
  const refunded = r2(pos(revenue.paymentsRefunded));
  const collected = r2(pos(revenue.paymentsCompleted));
  const collectedGross = r2(collected + refunded);
  const balanceDue = r2(Math.max(invoiced - collected, 0));

  // ---- vendor cost ----
  const vendorPaid = r2(pos(vendor.paidPayoutTotal));
  const vendorCommittedRaw =
    pos(vendor.approvedBillTotal) + pos(vendor.approvedUnlinkedPayoutNet) + pos(vendor.paidUnlinkedPayoutNet);
  // A paid cost is by definition committed — never let rounding/netting drift
  // show "committed < paid".
  const vendorCommitted = r2(Math.max(vendorCommittedRaw, vendorPaid));
  const vendorAgreed = r2(pos(vendor.agreedRateTotal));

  // ---- other cost (commission / owner payout / cash referral) ----
  const otherPaid = r2(pos(other.paid));
  const otherCommitted = r2(Math.max(pos(other.committed) + otherPaid, otherPaid));

  const pendingCost = r2(pos(vendor.pendingPayoutTotal) + pos(other.pending));
  const paidCost = r2(vendorPaid + otherPaid);
  const committedCost = r2(vendorCommitted + otherCommitted);
  const hasCostData = vendor.recordCount > 0 || other.recordCount > 0;

  // ---- staff (estimate only; never in margin) ----
  const staff = estimateStaffCost(input.staff);

  // ---- margin ----
  const grossMargin = hasCostData ? r2(collected - paidCost) : null;
  const marginPct = hasCostData && collected > 0 && grossMargin != null ? r2((grossMargin / collected) * 100) : null;
  const committedMargin = hasCostData ? r2(collected - committedCost) : null;

  // ---- flags ----
  const flags: ProfitabilityFlag[] = [];
  if (revenue.issuedInvoiceCount <= 0) flags.push("NO_INVOICE");
  if (balanceDue > EPS) flags.push("BALANCE_DUE");
  if (refunded > EPS) flags.push("REFUNDED");
  if (!hasCostData) flags.push("NO_COST_DATA");
  if (pendingCost > EPS) flags.push("COSTS_PENDING_APPROVAL");
  if (vendorAgreed > EPS && vendor.recordCount === 0) flags.push("VENDOR_UNBILLED");
  if (committedCost - paidCost > EPS) flags.push("COSTS_UNPAID");
  if (staff.unratedCount > 0) flags.push("STAFF_UNRATED");
  if (grossMargin != null && grossMargin < -EPS) flags.push("NEGATIVE_MARGIN");

  let dataStatus: DataStatus;
  if (invoiced <= EPS && collectedGross <= EPS) dataStatus = "no-revenue";
  else if (!hasCostData) dataStatus = "no-cost-data";
  else if (
    flags.some((f) =>
      f === "COSTS_UNPAID" ||
      f === "VENDOR_UNBILLED" ||
      f === "COSTS_PENDING_APPROVAL" ||
      f === "STAFF_UNRATED" ||
      f === "BALANCE_DUE",
    )
  )
    dataStatus = "partial";
  else dataStatus = "complete";

  return {
    ...booking,
    contractValue: r2(pos(booking.contractValue)),
    invoiced,
    collected,
    collectedGross,
    refunded,
    balanceDue,
    vendorPaid,
    vendorCommitted,
    vendorAgreed,
    otherPaid,
    otherCommitted,
    pendingCost,
    paidCost,
    committedCost,
    staffCost: staff.cost,
    staffHours: staff.hours,
    staffAssignmentCount: staff.assignmentCount,
    staffUnratedCount: staff.unratedCount,
    grossMargin,
    marginPct,
    committedMargin,
    hasCostData,
    dataStatus,
    flags,
  };
}

export function summarizeEventProfitability(rows: EventProfitabilityRow[]): EventProfitabilityTotals {
  const t: EventProfitabilityTotals = {
    bookings: rows.length,
    costedBookings: 0,
    noCostDataBookings: 0,
    noRevenueBookings: 0,
    contractValue: 0,
    invoiced: 0,
    collected: 0,
    refunded: 0,
    vendorPaid: 0,
    vendorCommitted: 0,
    otherPaid: 0,
    otherCommitted: 0,
    pendingCost: 0,
    paidCost: 0,
    committedCost: 0,
    grossMargin: 0,
    costedCollected: 0,
    avgMarginPct: null,
    staffCost: 0,
    staffEstimatedBookings: 0,
    staffUnratedBookings: 0,
  };
  for (const r of rows) {
    t.contractValue += r.contractValue;
    t.invoiced += r.invoiced;
    t.collected += r.collected;
    t.refunded += r.refunded;
    t.vendorPaid += r.vendorPaid;
    t.vendorCommitted += r.vendorCommitted;
    t.otherPaid += r.otherPaid;
    t.otherCommitted += r.otherCommitted;
    t.pendingCost += r.pendingCost;
    t.paidCost += r.paidCost;
    t.committedCost += r.committedCost;
    if (r.hasCostData && r.grossMargin != null) {
      t.costedBookings += 1;
      t.grossMargin += r.grossMargin;
      t.costedCollected += r.collected;
    } else {
      t.noCostDataBookings += 1;
    }
    if (r.dataStatus === "no-revenue") t.noRevenueBookings += 1;
    if (r.staffCost != null) {
      t.staffCost += r.staffCost;
      t.staffEstimatedBookings += 1;
    }
    if (r.staffUnratedCount > 0) t.staffUnratedBookings += 1;
  }
  for (const k of [
    "contractValue", "invoiced", "collected", "refunded", "vendorPaid", "vendorCommitted",
    "otherPaid", "otherCommitted", "pendingCost", "paidCost", "committedCost", "grossMargin",
    "costedCollected", "staffCost",
  ] as const) {
    t[k] = r2(t[k]);
  }
  t.avgMarginPct = t.costedCollected > 0 ? r2((t.grossMargin / t.costedCollected) * 100) : null;
  return t;
}
