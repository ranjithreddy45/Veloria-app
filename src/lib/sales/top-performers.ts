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

// ============================================================
// The game layer. Every line below is derived from the same rows — a chase
// that names a real gap to a real colleague, awards that a real number won.
// Nothing is invented to make the board look livelier than the period was.
// ============================================================

export interface FullPerformerInput extends PerformerInput {
  siteVisits: number;
  quotationsSent: number;
  salesScore: number;
}

/**
 * The one line addressed to the person looking at the board. Null when the
 * viewer is not on it and has nothing on record — a rep with no closes is told
 * how far the board is, never shamed with a rank.
 */
/** Everyone on a given count, named fairly: "Asha", "Asha and Kiran", or "the 3 people on 4". */
function namesOn(ranked: readonly RankedPerformer[], closed: number): string {
  const group = ranked.filter((r) => r.bookingsConfirmed === closed).map((r) => r.name);
  if (group.length === 1) return group[0];
  if (group.length === 2) return `${group[0]} and ${group[1]}`;
  return `the ${group.length} people on ${closed}`;
}

export function chaseLine(ranked: readonly RankedPerformer[], viewerId: string | null | undefined): string | null {
  if (!viewerId) return null;
  const me = ranked.find((r) => r.userId === viewerId);

  if (!me) {
    const last = ranked.at(-1);
    if (!last) return "Nobody has closed yet this period. The first booking takes 1st place.";
    return last.bookingsConfirmed === 1
      ? "One confirmed booking puts you on the board."
      : `One confirmed booking puts you on the board; ${last.bookingsConfirmed} ties you with ${namesOn(ranked, last.bookingsConfirmed)}.`;
  }

  if (me.place === 1) {
    const chaser = ranked.find((r) => r.place > 1);
    if (me.tied) return "You're tied for 1st. One more and the top spot is yours alone.";
    if (!chaser) return "You're 1st — and the only one on the board so far.";
    const lead = me.bookingsConfirmed - chaser.bookingsConfirmed;
    return `You're 1st, ${lead} ahead of ${namesOn(ranked, chaser.bookingsConfirmed)}.`;
  }

  // The nearest person strictly ahead: the smallest count above mine.
  const ahead = [...ranked].reverse().find((r) => r.bookingsConfirmed > me.bookingsConfirmed);
  if (!ahead) return null;
  const gap = ahead.bookingsConfirmed - me.bookingsConfirmed;
  const placeText = me.tied ? `joint ${ordinal(me.place)}` : ordinal(me.place);
  return `You're ${placeText}. ${gap} more ${gap === 1 ? "ties" : "to tie"} ${namesOn(ranked, ahead.bookingsConfirmed)}, ${gap + 1} to pass.`;
}

export interface Award {
  id: "closer" | "value" | "visits" | "quotes" | "velos";
  title: string;
  /** Who holds it; more than one name when the top figure is shared. */
  holders: { userId: string; name: string }[];
  /** The winning figure, as it should be shown. */
  figure: string;
}

const rupees = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

/**
 * Period awards. One per measure, given only when someone actually has a
 * figure above zero; a shared top figure is shared, not decided by name order.
 */
export function periodAwards(rows: readonly FullPerformerInput[]): Award[] {
  const measures: { id: Award["id"]; title: string; pick: (r: FullPerformerInput) => number; show: (n: number) => string }[] = [
    { id: "closer", title: "Top closer", pick: (r) => r.bookingsConfirmed, show: (n) => `${n} closed` },
    { id: "value", title: "Biggest book", pick: (r) => r.revenue, show: (n) => `${rupees(n)} booked` },
    { id: "visits", title: "Site-visit champion", pick: (r) => r.siteVisits, show: (n) => `${n} site visits` },
    { id: "quotes", title: "Quote machine", pick: (r) => r.quotationsSent, show: (n) => `${n} quotes sent` },
    { id: "velos", title: "Velos leader", pick: (r) => r.salesScore, show: (n) => `${Math.round(n)} pts` },
  ];

  const awards: Award[] = [];
  for (const m of measures) {
    const best = Math.max(0, ...rows.map((r) => (Number.isFinite(m.pick(r)) ? m.pick(r) : 0)));
    if (best <= 0) continue;
    awards.push({
      id: m.id,
      title: m.title,
      holders: rows.filter((r) => m.pick(r) === best).map((r) => ({ userId: r.userId, name: r.name })),
      figure: m.show(best),
    });
  }
  return awards;
}

/** Bar length against the leader, 0–100. The leader is always a full bar. */
export function raceShare(closed: number, leaderClosed: number): number {
  if (!(leaderClosed > 0) || !(closed > 0)) return 0;
  return Math.max(4, Math.min(100, Math.round((closed / leaderClosed) * 100)));
}
