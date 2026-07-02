// ============================================================
// BD analytics — date-range resolver (shared client + server)
// ------------------------------------------------------------
// Timeline presets for the BD dashboard & reports. All boundaries are anchored
// to IST (Asia/Kolkata, fixed +5:30, no DST) so "today"/"this month" line up
// with how the India-based team actually experiences the day, regardless of the
// server's UTC clock. The returned start/end are absolute UTC instants suitable
// for Prisma `gte`/`lte` filters.
// ============================================================

export type BdRangeKey = "day" | "week" | "month" | "fy" | "custom";

export interface ResolvedRange {
  key: BdRangeKey;
  start: Date;
  end: Date;
  label: string;
  /** ISO yyyy-mm-dd of the start/end in IST — handy for <input type="date"> */
  fromDate: string;
  toDate: string;
}

export const BD_RANGE_OPTIONS: { value: BdRangeKey; label: string }[] = [
  { value: "day", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "fy", label: "Financial year" },
  { value: "custom", label: "Custom range" },
];

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** The UTC instant for a given IST wall-clock date+time. */
function istWallToUtc(y: number, m: number, d: number, h = 0, min = 0, s = 0, ms = 0): Date {
  return new Date(Date.UTC(y, m, d, h, min, s, ms) - IST_OFFSET_MS);
}

/** Y/M/D of an instant as seen on an IST wall clock. */
function istYmd(instant: Date): { y: number; m: number; d: number } {
  const shifted = new Date(instant.getTime() + IST_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate() };
}

function startOfIstDay(instant: Date): Date {
  const { y, m, d } = istYmd(instant);
  return istWallToUtc(y, m, d, 0, 0, 0, 0);
}
function endOfIstDay(instant: Date): Date {
  const { y, m, d } = istYmd(instant);
  return istWallToUtc(y, m, d, 23, 59, 59, 999);
}

/** IST yyyy-mm-dd string for an instant. */
export function istDateStr(instant: Date): string {
  const { y, m, d } = istYmd(instant);
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d + 1).padStart(2, "0")}`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Resolve a preset (or custom from/to) into an absolute [start, end] window.
 * `now` is injectable for testing; defaults to the current instant.
 */
export function resolveBdRange(
  key: BdRangeKey,
  fromISO?: string | null,
  toISO?: string | null,
  now: Date = new Date()
): ResolvedRange {
  const nowY = istYmd(now);

  if (key === "day") {
    const start = startOfIstDay(now);
    const end = endOfIstDay(now);
    return pack("day", start, end, `${nowY.d} ${MONTHS[nowY.m]} ${nowY.y}`);
  }

  if (key === "week") {
    // ISO week: Monday → Sunday, containing today (IST).
    const todayStart = startOfIstDay(now);
    // getUTCDay on the IST-shifted instant gives the IST weekday.
    const istShift = new Date(now.getTime() + IST_OFFSET_MS);
    const dow = istShift.getUTCDay(); // 0 = Sun … 6 = Sat
    const backToMonday = (dow + 6) % 7; // days since Monday
    const start = new Date(todayStart.getTime() - backToMonday * 86400000);
    const end = new Date(start.getTime() + 7 * 86400000 - 1);
    const s = istYmd(start);
    const e = istYmd(end);
    return pack("week", start, end, `${s.d} ${MONTHS[s.m]} – ${e.d} ${MONTHS[e.m]}`);
  }

  if (key === "month") {
    const start = istWallToUtc(nowY.y, nowY.m, 1, 0, 0, 0, 0);
    // First day of next month, minus 1ms.
    const nextMonth = nowY.m === 11 ? istWallToUtc(nowY.y + 1, 0, 1) : istWallToUtc(nowY.y, nowY.m + 1, 1);
    const end = new Date(nextMonth.getTime() - 1);
    return pack("month", start, end, `${MONTHS[nowY.m]} ${nowY.y}`);
  }

  if (key === "fy") {
    // Indian FY: Apr 1 → Mar 31. Month index 3 = April.
    const fyStartYear = nowY.m >= 3 ? nowY.y : nowY.y - 1;
    const start = istWallToUtc(fyStartYear, 3, 1, 0, 0, 0, 0);
    const end = new Date(istWallToUtc(fyStartYear + 1, 3, 1).getTime() - 1);
    return pack("fy", start, end, `FY ${fyStartYear}–${String(fyStartYear + 1).slice(-2)}`);
  }

  // custom (fallback to current month when incomplete)
  if (fromISO && toISO) {
    const [fy, fm, fd] = fromISO.split("-").map(Number);
    const [ty, tm, td] = toISO.split("-").map(Number);
    if (fy && fm && fd && ty && tm && td) {
      const start = istWallToUtc(fy, fm - 1, fd, 0, 0, 0, 0);
      const end = istWallToUtc(ty, tm - 1, td, 23, 59, 59, 999);
      return pack("custom", start, end, `${fd} ${MONTHS[fm - 1]} – ${td} ${MONTHS[tm - 1]}`);
    }
  }
  // Incomplete custom → this month.
  return resolveBdRange("month", null, null, now);
}

function pack(key: BdRangeKey, start: Date, end: Date, label: string): ResolvedRange {
  return { key, start, end, label, fromDate: istDateStr(start), toDate: istDateStr(end) };
}
