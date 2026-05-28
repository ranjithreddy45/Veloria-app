import { describe, it, expect } from "vitest";
import {
  calculateLeadScore,
  calculateLeadScoreWithBreakdown,
} from "./lead-scoring";

describe("calculateLeadScore", () => {
  it("returns 0 for an empty lead with no event date (penalty clamps at 0)", () => {
    // No eventDate = -10, clamped to 0
    expect(calculateLeadScore({})).toBe(0);
  });

  it("awards budget points for >= 2 lakh", () => {
    const withEvent = { eventDate: new Date() };
    const low = calculateLeadScore({ ...withEvent, estimatedValue: 100000 });
    const high = calculateLeadScore({ ...withEvent, estimatedValue: 200000 });
    expect(high - low).toBe(20);
  });

  it("awards referral source the biggest single boost (+25)", () => {
    const base = { eventDate: new Date() };
    const referral = calculateLeadScore({ ...base, source: "REFERRAL" });
    const website = calculateLeadScore({ ...base, source: "WEBSITE" });
    expect(referral - website).toBe(25);
  });

  it("awards +15 for an event within 3 months", () => {
    const soon = new Date();
    soon.setMonth(soon.getMonth() + 1); // 1 month away
    const far = new Date();
    far.setMonth(far.getMonth() + 8); // 8 months away
    expect(calculateLeadScore({ eventDate: soon })).toBeGreaterThan(
      calculateLeadScore({ eventDate: far })
    );
  });

  it("penalizes a stale NEW lead created more than 7 days ago", () => {
    const old = new Date();
    old.setDate(old.getDate() - 10);
    // Give both leads a high baseline (referral + budget) so the stale
    // penalty stays above the 0 floor and the -20 delta is observable.
    const base = {
      eventDate: new Date(),
      status: "NEW",
      source: "REFERRAL",
      estimatedValue: 300000,
    };
    const fresh = calculateLeadScore({ ...base, createdAt: new Date() });
    const stale = calculateLeadScore({ ...base, createdAt: old });
    expect(fresh - stale).toBe(20);
  });

  it("clamps the stale penalty at the 0 floor (no negative scores)", () => {
    const old = new Date();
    old.setDate(old.getDate() - 10);
    // A bare stale lead would be -5 raw; it must clamp to 0.
    const stale = calculateLeadScore({
      eventDate: new Date(),
      status: "NEW",
      createdAt: old,
    });
    expect(stale).toBe(0);
  });

  it("never returns a score below 0 or above 100", () => {
    const everything = calculateLeadScore({
      estimatedValue: 5000000,
      eventDate: new Date(),
      followUpDate: new Date(),
      source: "REFERRAL",
      guestCount: 500,
    });
    expect(everything).toBeLessThanOrEqual(100);
    expect(everything).toBeGreaterThanOrEqual(0);

    const worst = calculateLeadScore({
      status: "NEW",
      createdAt: new Date("2020-01-01"),
    });
    expect(worst).toBeGreaterThanOrEqual(0);
  });

  it("breakdown total matches the direct score", () => {
    const lead = {
      estimatedValue: 300000,
      eventDate: new Date(),
      source: "REFERRAL",
      guestCount: 150,
    };
    expect(calculateLeadScoreWithBreakdown(lead).total).toBe(
      calculateLeadScore(lead)
    );
  });

  it("breakdown marks the correct factors as applied", () => {
    const { factors } = calculateLeadScoreWithBreakdown({
      estimatedValue: 300000,
      source: "REFERRAL",
      eventDate: new Date(),
    });
    const referralFactor = factors.find((f) =>
      f.label.includes("Referral")
    );
    expect(referralFactor?.applied).toBe(true);
  });
});
