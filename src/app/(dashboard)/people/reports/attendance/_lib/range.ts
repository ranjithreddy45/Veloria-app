// Server-safe default date range for the range-based reports: the first day of
// the current IST calendar month → today (IST), both as "YYYY-MM-DD". Built from
// the IST calendar day so the range doesn't drift under the UTC offset.

export function defaultRange(): { from: string; to: string } {
  // Today's IST calendar day, e.g. "2026-07-11".
  const todayIst = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const from = `${todayIst.slice(0, 7)}-01`;
  return { from, to: todayIst };
}
