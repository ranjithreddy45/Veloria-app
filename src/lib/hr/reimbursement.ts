// Shared reimbursement constants. Kept OUT of the "use server" actions file — a
// "use server" module may only export async functions, so a value export like this
// there breaks the Next.js build (caught only by a full `next build`, not by tsc).

export const REIMBURSEMENT_CATEGORIES = ["TRAVEL", "MEDICAL", "TELEPHONE", "FUEL", "BOOKS", "OTHER"] as const;
export type ReimbursementCategory = (typeof REIMBURSEMENT_CATEGORIES)[number];

// ============================================================
// Monthly fuel cap (per employee).
// ------------------------------------------------------------
// Employee.fuelMonthlyCap holds the rupee limit for one calendar month of fuel
// claims; null means no cap. The standard cap is ₹5,500, which the business
// equates to 50 litres. The month is the EXPENSE month (the claim date), and
// the running total counts every fuel claim in that month that has not been
// rejected or withdrawn — so a pending claim already uses up its share.
// ============================================================

/** The standard monthly fuel limit, in rupees (≈ 50 litres). */
export const FUEL_CAP_STANDARD = 5500;

const inr0 = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

/** The validation message an employee sees when a claim would breach the cap. */
export function fuelCapMessage(cap: number, alreadyClaimed: number): string {
  const head =
    cap === FUEL_CAP_STANDARD
      ? `Your monthly fuel reimbursement limit is ${inr0(cap)} (up to 50 litres). You cannot submit a claim exceeding this limit.`
      : `Your monthly fuel reimbursement limit is ${inr0(cap)}. You cannot submit a claim exceeding this limit.`;
  const left = Math.max(0, cap - alreadyClaimed);
  return alreadyClaimed > 0
    ? `${head} You have already claimed ${inr0(alreadyClaimed)} for this month, so ${inr0(left)} remains.`
    : head;
}

export type FuelCapResult = { ok: true } | { ok: false; message: string };

/**
 * Would this claim take the employee over their monthly fuel cap?
 * `alreadyClaimed` must exclude the claim being checked (it matters on edit).
 * Amounts are compared in paise so ₹5,500.00 exactly is allowed.
 */
export function checkFuelCap(input: { cap: number | null; alreadyClaimed: number; amount: number }): FuelCapResult {
  if (input.cap == null) return { ok: true };
  const paise = (n: number) => Math.round(n * 100);
  if (paise(input.alreadyClaimed) + paise(input.amount) <= paise(input.cap)) return { ok: true };
  return { ok: false, message: fuelCapMessage(input.cap, input.alreadyClaimed) };
}

/** UTC bounds of the calendar month a claim date falls in (claimDate is @db.Date). */
export function claimMonthBounds(claimDate: Date): { from: Date; to: Date } {
  const y = claimDate.getUTCFullYear();
  const m = claimDate.getUTCMonth();
  return { from: new Date(Date.UTC(y, m, 1)), to: new Date(Date.UTC(y, m + 1, 0)) };
}
