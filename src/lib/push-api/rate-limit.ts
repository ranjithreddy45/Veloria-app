import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { PushApiError } from "./errors";

// ============================================================
// Per-key fixed-window rate limiting, counted in Postgres.
//
// Production runs several app instances behind Apache. The in-memory limiter
// in src/lib/rate-limit.ts counts per instance, so with four instances a key
// would get four times its limit. One atomic INSERT … ON CONFLICT DO UPDATE per
// window keeps a single count however many instances there are, and two
// requests racing into the same window can't both read "99" and both pass.
// ============================================================

export type RateWindow = "minute" | "hour" | "day";

const WINDOW_MS: Record<RateWindow, number> = { minute: 60_000, hour: 3_600_000, day: 86_400_000 };

export function windowStart(now: number, window: RateWindow): Date {
  const size = WINDOW_MS[window];
  return new Date(Math.floor(now / size) * size);
}

export interface RateLimitResult {
  headers: Record<string, string>;
}

/**
 * Atomically add one to a window and return the new count.
 *
 * The window start is bound as UTC TEXT cast to `timestamp`, never as a JS
 * Date. A raw Date parameter is sent as `timestamptz`, and Postgres converts
 * it into this `timestamp` column using the SESSION time zone — which on the
 * production server is America/New_York. That stored every window four hours
 * early, so the daily cleanup ("older than 2h") deleted live counters and
 * quietly reset every key's limits. Prisma's own reads and writes treat the
 * column as UTC, so UTC text is what must go in.
 */
async function increment(counterKey: string, window: string, start: Date): Promise<number> {
  const startUtc = start.toISOString().replace("T", " ").replace("Z", "");
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "PushRateLimitCounter" ("id", "apiKeyId", "window", "windowStart", "count")
    VALUES (${randomUUID()}, ${counterKey}, ${window}, ${startUtc}::timestamp, 1)
    ON CONFLICT ("apiKeyId", "window", "windowStart")
    DO UPDATE SET "count" = "PushRateLimitCounter"."count" + 1
    RETURNING "count"`;
  return Number(rows[0]?.count ?? 1);
}

/**
 * Count one NEW lead against the key's daily cap (UTC day). Called only when a
 * lead is about to be created, so duplicates and updates never use it up.
 */
export async function consumeDailyLeadCap(apiKeyId: string, maxPerDay: number, now: number = Date.now()): Promise<void> {
  const dayStart = windowStart(now, "day");
  const count = await increment(apiKeyId, "day:new_leads", dayStart);
  if (count > maxPerDay) {
    const retryAfter = Math.max(1, Math.ceil((dayStart.getTime() + WINDOW_MS.day - now) / 1000));
    throw new PushApiError(
      "LEAD_CAP_REACHED",
      `This API key has created its maximum of ${maxPerDay} new leads for today (UTC).`,
      undefined,
      { "Retry-After": String(retryAfter) }
    );
  }
}

/**
 * Count this request against both windows, then decide.
 *
 * Every attempt counts, including rejected ones, so a client hammering past its
 * limit stays limited instead of getting a free request each time a slot frees.
 */
export async function consumeRateLimit(
  apiKeyId: string,
  limits: { perMinute: number; perHour: number },
  now: number = Date.now()
): Promise<RateLimitResult> {
  const minuteStart = windowStart(now, "minute");
  const hourStart = windowStart(now, "hour");
  const [minuteCount, hourCount] = await Promise.all([
    increment(apiKeyId, "minute", minuteStart),
    increment(apiKeyId, "hour", hourStart),
  ]);
  return decideRateLimit({ minuteCount, hourCount, minuteStart, hourStart, limits, now });
}

/** Pure decision, separated so the boundaries can be tested without a database. */
export function decideRateLimit(args: {
  minuteCount: number;
  hourCount: number;
  minuteStart: Date;
  hourStart: Date;
  limits: { perMinute: number; perHour: number };
  now: number;
}): RateLimitResult {
  const { minuteCount, hourCount, minuteStart, hourStart, limits, now } = args;
  const minuteReset = minuteStart.getTime() + WINDOW_MS.minute;
  const hourReset = hourStart.getTime() + WINDOW_MS.hour;

  // Report whichever window is closer to running out.
  const minuteLeft = limits.perMinute - minuteCount;
  const hourLeft = limits.perHour - hourCount;
  const tighter = hourLeft < minuteLeft ? "hour" : "minute";
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(tighter === "hour" ? limits.perHour : limits.perMinute),
    "X-RateLimit-Remaining": String(Math.max(0, tighter === "hour" ? hourLeft : minuteLeft)),
    "X-RateLimit-Reset": String(Math.ceil((tighter === "hour" ? hourReset : minuteReset) / 1000)),
  };

  if (minuteCount > limits.perMinute || hourCount > limits.perHour) {
    const blockedUntil = hourCount > limits.perHour ? hourReset : minuteReset;
    const retryAfter = Math.max(1, Math.ceil((blockedUntil - now) / 1000));
    throw new PushApiError(
      "RATE_LIMITED",
      hourCount > limits.perHour
        ? `Rate limit exceeded: ${limits.perHour} requests per hour.`
        : `Rate limit exceeded: ${limits.perMinute} requests per minute.`,
      undefined,
      { ...headers, "X-RateLimit-Remaining": "0", "Retry-After": String(retryAfter) }
    );
  }
  return { headers };
}
