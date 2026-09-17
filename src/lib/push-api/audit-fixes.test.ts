// Unit-level regression tests for the Push API audit (17 Sep 2026).
// Each block names the audit finding it guards.
import { beforeEach, describe, expect, it } from "vitest";
import { exceedsDepth, isValidIsoDate, parsePushLead } from "./leads/schema";
import { eventsCompatible, samePhone } from "./leads/ingest";
import { arrivedOverHttps, clientIp } from "./http";
import { assertNotBlocked, recordAuthFailure, resetAuthFailures } from "./guard";
import { canonicalJson, requestHash } from "./idempotency";
import { generatePushKey, looksLikePushKey } from "./keys";
import { PushApiError } from "./errors";

describe("H3 — phone matching respects the country code", () => {
  it("matches the same number however it was stored", () => {
    expect(samePhone("9876543210", "+919876543210")).toBe(true);
    expect(samePhone("+91 98765-43210", "+919876543210")).toBe(true);
    expect(samePhone("09876543210", "+919876543210")).toBe(true);
  });
  it("never matches a different country with the same last ten digits", () => {
    expect(samePhone("+9719876543210", "+919876543210")).toBe(false);
    expect(samePhone("+919876543210", "+9719876543210")).toBe(false);
  });
  it("never matches a stored number whose country can't be known", () => {
    expect(samePhone("4155552671", "+14155552671")).toBe(false);
    expect(samePhone(null, "+919876543210")).toBe(false);
  });
});

describe("M2 — only compatible events are the same enquiry", () => {
  const stored = { eventType: "wedding", eventDate: new Date("2026-12-20T00:00:00Z") };
  it("treats blanks as compatible", () => {
    expect(eventsCompatible({}, stored)).toBe(true);
    expect(eventsCompatible({ eventType: "Wedding" }, { eventType: null, eventDate: null })).toBe(true);
  });
  it("matches the same type (any case) and day", () => {
    expect(eventsCompatible({ eventType: "WEDDING", eventDate: "2026-12-20" }, stored)).toBe(true);
  });
  it("separates a different event type or a different day", () => {
    expect(eventsCompatible({ eventType: "corporate" }, stored)).toBe(false);
    expect(eventsCompatible({ eventDate: "2027-03-01" }, stored)).toBe(false);
  });
});

describe("M9 — deep nesting is a 422, never a stack overflow", () => {
  it("exceedsDepth is iterative and stops early", () => {
    const deep = JSON.parse(`${"[".repeat(50_000)}${"]".repeat(50_000)}`);
    expect(exceedsDepth(deep, 3)).toBe(true);
    expect(exceedsDepth({ a: { b: { c: 1 } } }, 3)).toBe(false);
    expect(exceedsDepth({ a: { b: { c: { d: 1 } } } }, 3)).toBe(true);
  });
  it("parsePushLead rejects 30,000-deep metadata with a field error", () => {
    const raw = `{"source":"website","phone":"9876543210","metadata":{"a":${"[".repeat(30_000)}${"]".repeat(30_000)}}}`;
    const r = parsePushLead(JSON.parse(raw));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fields.metadata).toMatch(/levels deep/);
  });
  it("canonicalJson refuses absurd depth with a validation error instead of recursing forever", () => {
    const deep = JSON.parse(`${"[".repeat(1000)}${"]".repeat(1000)}`);
    expect(() => canonicalJson(deep)).toThrow(PushApiError);
  });
});

describe("L2 — event_date must be a real date and a real time", () => {
  it.each(["2026-12-20", "2026-12-20T18:30", "2026-12-20T18:30:59", "2026-12-20T18:30:59.123Z", "2026-12-20T23:30+05:30", "2026-12-20T23:30-0500"])(
    "accepts %s",
    (v) => expect(isValidIsoDate(v)).toBe(true)
  );
  it.each(["2026-12-20T99:99:99", "2026-12-20T:", "2026-12-20T1.2.3", "2026-12-20T24:00", "2026-12-20T18:60", "2026-12-20T", "2026-02-30"])(
    "rejects %s",
    (v) => expect(isValidIsoDate(v)).toBe(false)
  );
  it("keeps the calendar day as written, with no time-zone shift", () => {
    const r = parsePushLead({ source: "website", phone: "9876543210", event_date: "2026-12-20T23:30-05:00" });
    expect(r.ok && r.lead.eventDate).toBe("2026-12-20");
  });
});

describe("M7 — fbclid is capped where the attribution store caps it", () => {
  it("accepts 255 characters and rejects 256", () => {
    expect(parsePushLead({ source: "meta_ads", phone: "9876543210", fbclid: "f".repeat(255) }).ok).toBe(true);
    const r = parsePushLead({ source: "meta_ads", phone: "9876543210", fbclid: "f".repeat(256) });
    expect(r.ok).toBe(false);
  });
});

describe("L4 — the audit IP is the one our proxy wrote", () => {
  it("takes the LAST X-Forwarded-For hop, not the client-supplied first one", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.1" }))).toBe("198.51.100.1");
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe("HTTPS only", () => {
  it("with a trusted proxy, refuses a request it says arrived over plain HTTP", () => {
    expect(arrivedOverHttps(new Headers({ "x-forwarded-proto": "http" }), true)).toBe(false);
    expect(arrivedOverHttps(new Headers({ "x-forwarded-proto": "https" }), true)).toBe(true);
    expect(arrivedOverHttps(new Headers({ "x-forwarded-proto": "https, http" }), true)).toBe(true);
    expect(arrivedOverHttps(new Headers(), true)).toBe(true);
  });
  it("without a trusted proxy, never rejects — production regression: Next.js fills in 'http' itself", () => {
    // This exact header reached the app for EVERY genuine HTTPS request in
    // production (Apache doesn't set it; Next.js did), so all were refused.
    expect(arrivedOverHttps(new Headers({ "x-forwarded-proto": "http" }), false)).toBe(true);
  });
});

describe("M6 — failed authentication is throttled per IP before any database work", () => {
  beforeEach(() => resetAuthFailures());
  it("allows failures up to the limit, then blocks that IP for the rest of the minute", () => {
    const now = Date.UTC(2026, 8, 17, 10, 0, 10);
    for (let i = 0; i < 3; i++) {
      expect(() => assertNotBlocked("203.0.113.9", 3, now)).not.toThrow();
      expect(recordAuthFailure("203.0.113.9", 3, now)).toBe(true);
    }
    expect(() => assertNotBlocked("203.0.113.9", 3, now)).toThrow(PushApiError);
    try {
      assertNotBlocked("203.0.113.9", 3, now);
    } catch (e) {
      expect((e as PushApiError).status).toBe(429);
      expect((e as PushApiError).code).toBe("TOO_MANY_FAILED_ATTEMPTS");
      expect((e as PushApiError).headers?.["Retry-After"]).toBe("50");
    }
    // Another IP is unaffected; the next minute starts fresh.
    expect(() => assertNotBlocked("198.51.100.1", 3, now)).not.toThrow();
    expect(() => assertNotBlocked("203.0.113.9", 3, now + 60_000)).not.toThrow();
  });
  it("tells the caller to stop writing audit rows once past the limit", () => {
    const now = Date.now();
    expect(recordAuthFailure("192.0.2.1", 1, now)).toBe(true);
    expect(recordAuthFailure("192.0.2.1", 1, now)).toBe(false);
  });
});

describe("M6 — junk credentials are refused without a lookup", () => {
  it("recognises only the exact push-key shape", () => {
    expect(looksLikePushKey(generatePushKey().raw)).toBe(true);
    expect(looksLikePushKey("vg_live_short")).toBe(false);
    expect(looksLikePushKey(`vel_${"a".repeat(64)}`)).toBe(false);
    expect(looksLikePushKey("x".repeat(5000))).toBe(false);
  });
});

describe("Idempotency hashes the normalised request", () => {
  it("treats two spellings of the same phone as the same request", () => {
    const a = parsePushLead({ source: "website", phone: "9876543210", name: "A" });
    const b = parsePushLead({ phone: "+91 98765 43210", name: "A", source: "WEBSITE", ignored_field: 1 });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(requestHash(a.lead)).toBe(requestHash(b.lead));
  });
});
