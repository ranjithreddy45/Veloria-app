import { describe, it, expect } from "vitest";
import { workingDays, rangesOverlap, dateKey } from "./leave-calc";

const d = (s: string) => new Date(s + "T00:00:00.000Z");

describe("workingDays", () => {
  it("counts a single full weekday as 1", () => {
    expect(workingDays(d("2026-06-15"), d("2026-06-15"))).toBe(1); // Mon
  });
  it("counts a single half-day as 0.5", () => {
    expect(workingDays(d("2026-06-15"), d("2026-06-15"), "FIRST_HALF")).toBe(0.5);
  });
  it("returns 0 for a weekend day", () => {
    expect(workingDays(d("2026-06-13"), d("2026-06-13"))).toBe(0); // Sat
    expect(workingDays(d("2026-06-14"), d("2026-06-14"))).toBe(0); // Sun
  });
  it("excludes weekends across a Mon–Fri+weekend span", () => {
    // Mon 15 → Mon 22 June 2026: weekdays = 15,16,17,18,19, 22 = 6 days (skips 20,21)
    expect(workingDays(d("2026-06-15"), d("2026-06-22"))).toBe(6);
  });
  it("excludes holidays", () => {
    const hol = new Set([dateKey(d("2026-06-17"))]);
    expect(workingDays(d("2026-06-15"), d("2026-06-19"), "FULL", "FULL", hol)).toBe(4);
  });
  it("applies half-day on first (second-half) and last (first-half) days", () => {
    // Mon 15 second half + Tue 16 full + Wed 17 first half = 0.5 + 1 + 0.5 = 2
    expect(workingDays(d("2026-06-15"), d("2026-06-17"), "SECOND_HALF", "FIRST_HALF")).toBe(2);
  });
  it("returns 0 when end is before start", () => {
    expect(workingDays(d("2026-06-20"), d("2026-06-15"))).toBe(0);
  });
});

describe("rangesOverlap", () => {
  it("detects overlap", () => {
    expect(rangesOverlap(d("2026-06-10"), d("2026-06-15"), d("2026-06-14"), d("2026-06-20"))).toBe(true);
  });
  it("detects no overlap", () => {
    expect(rangesOverlap(d("2026-06-10"), d("2026-06-12"), d("2026-06-14"), d("2026-06-20"))).toBe(false);
  });
});
