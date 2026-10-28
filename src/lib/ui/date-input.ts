// ============================================================
// When may a date box's value be applied as a filter?
// ------------------------------------------------------------
// A native <input type="date"> reports a COMPLETE date on every keystroke of
// the year: typing "2026" fires 0002-11-01, 0020-11-01, 0202-11-01 and only
// then 2026-11-01. The Leads and BD filter bars pushed every one of those to
// the URL, so the page reloaded on the first digit, the box re-rendered from
// the URL, and the rest of the typing was lost — the filter stuck at year 2.
// Only an empty box (cleared) or a plausible year is applied. Pure.
// ============================================================

export const MIN_FILTER_YEAR = 2000;
export const MAX_FILTER_YEAR = 2100;

export function isCommittableDate(value: string): boolean {
  if (value === "") return true;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return y >= MIN_FILTER_YEAR && y <= MAX_FILTER_YEAR && mo >= 1 && mo <= 12 && d >= 1 && d <= 31;
}
