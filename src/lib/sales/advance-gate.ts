// ============================================================
// May this booking be confirmed by hand?
//
// A slot is confirmed when the advance is in — 20% of the value, the same
// threshold the automatic path (maybeConfirmBookingOnPayment) uses when a
// payment lands. Until this existed, the manual Confirm button skipped that
// check entirely, so a rep could lock a slot with nothing collected. Now both
// paths ask the same question of the same numbers.
//
// The advance is measured against the INVOICE total when an invoice exists
// (that is what the 20% installment was computed from) and the booking value
// otherwise. Payments count only once verified (COMPLETED) — a pending link is
// not money.
// ============================================================

export const ADVANCE_FRACTION = 0.2;

export interface AdvanceCheckInput {
  bookingTotal: number;
  /** Sum of COMPLETED payments across the booking's invoices. */
  paid: number;
  /** Invoice total when one exists; the 20% was computed from this. */
  invoiceTotal?: number | null;
}

export interface AdvanceCheck {
  ok: boolean;
  required: number;
  paid: number;
  shortfall: number;
}

export function checkAdvance(i: AdvanceCheckInput): AdvanceCheck {
  const base = i.invoiceTotal != null && i.invoiceTotal > 0 ? i.invoiceTotal : i.bookingTotal;
  // −1 mirrors the automatic path: rounding on a split installment must not
  // leave a customer one rupee short of a confirmation they have paid for.
  const required = Math.max(0, base * ADVANCE_FRACTION - 1);
  const paid = Number.isFinite(i.paid) ? Math.max(0, i.paid) : 0;
  return { ok: paid >= required, required, paid, shortfall: Math.max(0, required - paid) };
}

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

/** The refusal a rep sees — it names the gap, so the next step is obvious. */
export function advanceRefusal(c: AdvanceCheck): string {
  return `Collect the advance first: ${inr(c.paid)} received of the ${inr(c.required)} needed (20%). ${inr(c.shortfall)} more confirms this slot.`;
}
