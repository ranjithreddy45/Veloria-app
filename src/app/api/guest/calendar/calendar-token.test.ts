import { describe, it, expect } from "vitest";
import { CALENDAR_TOKEN_TTL_MS, signCalendarToken, verifyCalendarToken } from "./calendar-token";

const SECRET = "test-secret-please-ignore";
const NOW = Date.UTC(2026, 8, 16, 10, 0, 0);

describe("calendar tokens", () => {
  const token = signCalendarToken("booking_123", NOW + CALENDAR_TOKEN_TTL_MS, SECRET);

  it("opens the booking it was minted for, until it expires", () => {
    expect(verifyCalendarToken(token, "booking_123", SECRET, NOW)).toBe(true);
    expect(verifyCalendarToken(token, "booking_123", SECRET, NOW + CALENDAR_TOKEN_TTL_MS)).toBe(true);
    expect(verifyCalendarToken(token, "booking_123", SECRET, NOW + CALENDAR_TOKEN_TTL_MS + 1)).toBe(false);
  });

  it("never opens another booking, or verifies under another secret", () => {
    expect(verifyCalendarToken(token, "booking_124", SECRET, NOW)).toBe(false);
    expect(verifyCalendarToken(token, "booking_123", "other-secret", NOW)).toBe(false);
    expect(verifyCalendarToken(token, "booking_123", null, NOW)).toBe(false);
    expect(verifyCalendarToken(token, "", SECRET, NOW)).toBe(false);
  });

  it("rejects tampered and malformed tokens", () => {
    const [exp, mac] = token.split(".");
    const later = (parseInt(exp, 36) + 86_400_000).toString(36);
    expect(verifyCalendarToken(`${later}.${mac}`, "booking_123", SECRET, NOW)).toBe(false);
    expect(verifyCalendarToken(`${exp}.${mac.slice(0, -1)}A`, "booking_123", SECRET, NOW)).toBe(false);
    for (const bad of [null, undefined, "", ".", "abc", `.${mac}`, `${exp}.`, `ZZ!.${mac}`]) {
      expect(verifyCalendarToken(bad, "booking_123", SECRET, NOW), String(bad)).toBe(false);
    }
  });

  it("does not carry the booking id in the clear", () => {
    expect(token.includes("booking_123")).toBe(false);
  });
});
