// ============================================================
// The money vocabulary. One definition per number, named so two of them
// cannot be mistaken for each other.
//
// THE PROBLEM THIS SOLVES: three different quantities in this codebase were all
// called "revenue".
//
//   analytics.actions   Σ Payment.amount        — cash actually received
//   performance.actions Σ Booking.totalAmount   — value of bookings contracted
//   report.actions      Σ Booking.totalAmount   — same as above
//
// A ₹5,00,000 booking with a ₹1,50,000 advance paid contributes ₹5,00,000 to
// two of those and ₹1,50,000 to the third. Both are real, useful business
// figures — but they are NOT the same figure, and calling both "revenue" means
// two screens can show different numbers with nothing to explain the gap.
//
// The fix is not to force them equal. It is to stop using one word for two
// things. Every screen showing a money total should import its label from here,
// so the words on screen always match the formula behind them.
// ============================================================

/**
 * The two money quantities this business actually tracks.
 *
 * BOOKED_VALUE  — what customers have committed to pay (Booking.totalAmount).
 *                 The right number for sales performance, pipeline and
 *                 forecasting: it reflects what was SOLD.
 *
 * CASH_COLLECTED — what has actually landed (Σ Payment.amount). The right
 *                 number for cashflow and collections: it reflects what was
 *                 RECEIVED. Always ≤ booked value while instalments are open.
 */
export type MoneyMetric = "BOOKED_VALUE" | "CASH_COLLECTED";

interface MetricCopy {
  /** Tile label. Short, and never just "Revenue". */
  label: string;
  /** The one-line qualifier that MUST accompany the number. */
  sub: string;
  /** Longer explanation for help text and tooltips. */
  definition: string;
}

export const MONEY_METRIC: Record<MoneyMetric, MetricCopy> = {
  BOOKED_VALUE: {
    label: "Booked value",
    sub: "Contracted — not yet collected",
    definition:
      "The total value of confirmed bookings. This is what customers have committed to pay, including instalments still outstanding. It is not cash in the bank.",
  },
  CASH_COLLECTED: {
    label: "Cash collected",
    sub: "Payments received",
    definition:
      "Payments actually received. Lower than booked value whenever instalments are still outstanding, which is normal mid-event-cycle.",
  },
};

/**
 * Sum a set of booking amounts as BOOKED VALUE.
 *
 * Takes the already-fetched rows rather than querying, because callers scope
 * by wildly different things (employee, venue, month, status) and centralising
 * the WHERE would either be a mess of options or a lie. What matters is that
 * everyone agrees on the FIELD and the arithmetic.
 */
export function bookedValue(bookings: { totalAmount: unknown }[]): number {
  return bookings.reduce((sum, b) => sum + Number(b.totalAmount ?? 0), 0);
}

/** Sum a set of payments as CASH COLLECTED. */
export function cashCollected(payments: { amount: unknown }[]): number {
  return payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
}

/**
 * Collection rate — how much of what was sold has actually arrived.
 *
 * Returns null rather than 0 when nothing has been booked: 0% implies "we
 * collected nothing of what we sold", which is a different and much worse
 * statement than "we have not sold anything yet".
 */
export function collectionRate(booked: number, collected: number): number | null {
  if (booked <= 0) return null;
  return Math.round((collected / booked) * 100);
}
