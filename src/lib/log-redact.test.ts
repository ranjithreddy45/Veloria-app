import { describe, expect, it } from "vitest";
import { maskPhoneForLog, redactForLog, scrubSentryBreadcrumb, scrubSentryEvent } from "./log-redact";

describe("log redaction (R1-8)", () => {
  it("masks phones in several shapes, keeping only the last two digits", () => {
    expect(redactForLog("call +91 98765 43210 now")).toBe("call ***10 now");
    expect(redactForLog("9876543210")).toBe("***10");
    expect(redactForLog("tel:+91-98765-43210")).toBe("tel:***10");
    expect(maskPhoneForLog("+919876543210")).toBe("***10");
  });
  it("masks emails", () => {
    expect(redactForLog("from ravi.kumar@gmail.com today")).toBe("from r***@gmail.com today");
  });
  it("leaves dates, amounts and ids alone", () => {
    expect(redactForLog("2026-10-15T09:30:00Z")).toBe("2026-10-15T09:30:00Z");
    expect(redactForLog("₹309225 for VG-Q-00171")).toBe("₹309225 for VG-Q-00171");
    expect(redactForLog("cmv6ol9dk0rtaeh1mj0egnr7x")).toBe("cmv6ol9dk0rtaeh1mj0egnr7x");
  });
  it("scrubs a sample Sentry event and breadcrumb everywhere", () => {
    const event = {
      message: "Lead create failed for 9876543210",
      exception: { values: [{ value: "duplicate contact priya@example.com" }] },
      extra: { phone: "+91 91234 56789", nested: [{ email: "a.b@c.in" }] },
      request: { url: "https://app.example.com/api/x?phone=9876543210" },
    };
    const out = scrubSentryEvent(event);
    expect(JSON.stringify(out)).not.toMatch(/9876543210|priya@|91234 56789|a\.b@c/);
    expect(out.message).toBe("Lead create failed for ***10");
    const crumb = scrubSentryBreadcrumb({ category: "fetch", data: { url: "/api/otp?to=919876543210" } });
    expect(JSON.stringify(crumb)).not.toContain("919876543210");
  });
});
