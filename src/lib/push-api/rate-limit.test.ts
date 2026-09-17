import { describe, expect, it } from "vitest";
import { decideRateLimit, windowStart } from "./rate-limit";
import { PushApiError } from "./errors";

const now = Date.UTC(2026, 8, 17, 10, 30, 45, 500);
const limits = { perMinute: 100, perHour: 1000 };
const base = {
  minuteStart: windowStart(now, "minute"),
  hourStart: windowStart(now, "hour"),
  limits,
  now,
};

describe("windowStart", () => {
  it("floors to the minute and the hour", () => {
    expect(windowStart(now, "minute").toISOString()).toBe("2026-09-17T10:30:00.000Z");
    expect(windowStart(now, "hour").toISOString()).toBe("2026-09-17T10:00:00.000Z");
  });
});

describe("decideRateLimit", () => {
  it("allows requests within the limit and reports what is left", () => {
    const { headers } = decideRateLimit({ ...base, minuteCount: 1, hourCount: 1 });
    expect(headers["X-RateLimit-Limit"]).toBe("100");
    expect(headers["X-RateLimit-Remaining"]).toBe("99");
    expect(headers["X-RateLimit-Reset"]).toBe(String(Date.UTC(2026, 8, 17, 10, 31) / 1000));
  });

  it("allows the request that exactly reaches the limit", () => {
    expect(decideRateLimit({ ...base, minuteCount: 100, hourCount: 100 }).headers["X-RateLimit-Remaining"]).toBe("0");
  });

  it("refuses the request past the per-minute limit with 429 and Retry-After", () => {
    try {
      decideRateLimit({ ...base, minuteCount: 101, hourCount: 101 });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(PushApiError);
      const err = e as PushApiError;
      expect(err.status).toBe(429);
      expect(err.code).toBe("RATE_LIMITED");
      expect(err.headers?.["Retry-After"]).toBe("15"); // 14.5s left in the minute, rounded up
      expect(err.headers?.["X-RateLimit-Remaining"]).toBe("0");
    }
  });

  it("refuses past the per-hour limit even when the minute has room, and waits for the hour", () => {
    try {
      decideRateLimit({ ...base, minuteCount: 3, hourCount: 1001 });
      expect.unreachable();
    } catch (e) {
      const err = e as PushApiError;
      expect(err.message).toContain("per hour");
      expect(err.headers?.["X-RateLimit-Limit"]).toBe("1000");
      expect(Number(err.headers?.["Retry-After"])).toBe(1755); // 29m 14.5s → 1755s
    }
  });

  it("reports the hourly window when it is the tighter one", () => {
    const { headers } = decideRateLimit({ ...base, minuteCount: 2, hourCount: 995 });
    expect(headers["X-RateLimit-Limit"]).toBe("1000");
    expect(headers["X-RateLimit-Remaining"]).toBe("5");
  });
});
