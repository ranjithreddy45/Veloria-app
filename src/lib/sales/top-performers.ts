// ============================================================
// Who closed how many — the ranking behind the Sales dashboard's top strip.
//
// "Closed" here is exactly what the table further down the same page calls
// "Confirmed": bookings confirmed in the selected period, credited to the
// person who created the booking (getSalesAnalytics). This module only ORDERS
// those rows; it never recounts, so the strip and the table cannot disagree.
//
// Two rules that are easy to get wrong:
//  - Ties share a place (1, 2, 2, 4 — competition ranking). Two people on four
//    closes each are joint second; alphabetical order must not make one of them
//    look like they beat the other.
//  - People with no closes are left off the strip. It exists to celebrate, and
//    a public list ending in a row of zeros does the opposite; they still
//    appear, with all their other numbers, in the full table below.
// ============================================================

export interface PerformerInput {
  userId: string;
  name: string;
  bookingsConfirmed: number;
  revenue: number;
}

export interface RankedPerformer extends PerformerInput {
  /** 1-based place; equal closes share a place. */
  place: number;
  /** True when someone else has the same number of closes. */
  tied: boolean;
}

export function rankTopPerformers(rows: readonly PerformerInput[]): RankedPerformer[] {
  const closers = rows
    .filter((r) => Number.isFinite(r.bookingsConfirmed) && r.bookingsConfirmed > 0)
    // Revenue only orders people WITHIN a tie, for a stable, sensible display.
    // It never changes anyone's place — the strip ranks by closes, as labelled.
    .sort((a, b) => b.bookingsConfirmed - a.bookingsConfirmed || b.revenue - a.revenue || a.name.localeCompare(b.name));

  return closers.map((row) => {
    const firstWithSame = closers.findIndex((c) => c.bookingsConfirmed === row.bookingsConfirmed);
    const sameCount = closers.filter((c) => c.bookingsConfirmed === row.bookingsConfirmed).length;
    return { ...row, place: firstWithSame + 1, tied: sameCount > 1 };
  });
}

/** "1st", "2nd", "3rd", "4th", "11th", "22nd"… */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const last = n % 10;
  return `${n}${last === 1 ? "st" : last === 2 ? "nd" : last === 3 ? "rd" : "th"}`;
}
