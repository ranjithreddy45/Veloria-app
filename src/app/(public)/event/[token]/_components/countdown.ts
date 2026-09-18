// ============================================================
// The public event page's countdown wording. Pure: server, client and tests.
// ------------------------------------------------------------
// Afternoon and Evening have hours set by the team, so the page counts down to
// the slot's start. Morning and Full Day don't: their eventAtISO is only an ops
// planning anchor (src/lib/sales/slot.ts says never to show one as when a slot
// starts), so those count whole days to the event's calendar day in India and
// never show a clock time.
// ============================================================

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
/** India has no daylight saving: IST is always UTC+5:30. */
const IST_OFFSET_MS = 330 * MINUTE_MS;

export interface CountdownParts {
  ms: number;
  days: number;
  hours: number;
  minutes: number;
}

/** Time left until a start instant, in whole days, hours and minutes (never negative). */
export function diffParts(targetMs: number, nowMs: number): CountdownParts {
  const ms = Math.max(0, targetMs - nowMs);
  const totalMinutes = Math.floor(ms / MINUTE_MS);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return { ms, days, hours, minutes };
}

/**
 * Calendar days from today in India to the event's day ("YYYY-MM-DD", the booking's
 * @db.Date): 0 today, 1 tomorrow, negative once the day has passed.
 */
export function daysUntilEventDay(eventDateISO: string, nowMs: number): number {
  const eventDay = Math.floor(Date.parse(`${eventDateISO}T00:00:00.000Z`) / DAY_MS);
  const todayInIndia = Math.floor((nowMs + IST_OFFSET_MS) / DAY_MS);
  return eventDay - todayInIndia;
}

/** Headline for a slot without hours: whole days only. null once the day has passed. */
export function dayCountHeadline(occasion: string, daysAway: number): string | null {
  if (!Number.isFinite(daysAway) || daysAway < 0) return null;
  if (daysAway === 0) return `Your ${occasion} is today`;
  if (daysAway === 1) return `Your ${occasion} is tomorrow`;
  return `Your ${occasion} is in ${daysAway} days`;
}

/** Headline for a slot with hours, counting down to its start. null once it has started. */
export function timedHeadline(occasion: string, parts: CountdownParts): string | null {
  if (parts.ms <= 0) return null;
  if (parts.days > 0) return `Your ${occasion} is in ${parts.days} ${parts.days === 1 ? "day" : "days"}`;
  if (parts.hours > 0) return `Your ${occasion} is in ${parts.hours} ${parts.hours === 1 ? "hour" : "hours"}`;
  return `Your ${occasion} starts in ${parts.minutes} ${parts.minutes === 1 ? "minute" : "minutes"}`;
}
