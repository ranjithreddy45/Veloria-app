// Client-safe formatters for the attendance reports. All clock times are shown
// in IST; day boundaries are UTC-midnight (@db.Date), so calendar dates are read
// in UTC to avoid shifting a day under the IST offset.

/** "11 Jul 2026" — the attendance day, read in UTC (matches @db.Date storage). */
export function fmtDay(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** "YYYY-MM-DD" of the attendance day, read in UTC (for CSV / stable keys). */
export function fmtDayIso(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** "09:32" — a clock time formatted in IST. */
export function fmtTimeIst(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  }).format(date);
}

/** Minutes → "7h 45m" (or "7.75" style not used — HR reads h/m). */
export function fmtHm(minutes: number | null | undefined): string {
  const m = minutes ?? 0;
  if (m <= 0) return "0m";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}

/** Minutes → decimal hours string for CSV (e.g. "7.75"). */
export function hoursDecimal(minutes: number | null | undefined): string {
  return ((minutes ?? 0) / 60).toFixed(2);
}

/** Minutes-since-midnight → "09:30" for expected-in/out labels. */
export function fmtMinuteClock(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Google Maps link for a coordinate pair, or null when coords are missing. */
export function mapsLink(lat: number | null | undefined, lng: number | null | undefined): string | null {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** The last N Indian FYs (Apr-start), newest first — for the FY selector. */
export function recentFys(count = 5): string[] {
  const now = new Date();
  const y = now.getFullYear();
  const startYear = now.getMonth() + 1 >= 4 ? y : y - 1;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const s = startYear - i;
    out.push(`${s}-${String((s + 1) % 100).padStart(2, "0")}`);
  }
  return out;
}
