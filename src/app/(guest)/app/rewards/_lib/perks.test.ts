import { describe, it, expect } from "vitest";
import {
  decidePerks,
  describePartnerPayout,
  describeReferralRule,
  referralStatusWord,
  signedPoints,
  tierName,
  tierProgress,
  validateRedemption,
  type PartnerInput,
  type PerksInput,
  type RewardRuleInput,
} from "./perks";

const rule = (over: Partial<RewardRuleInput> = {}): RewardRuleInput => ({
  id: "r1",
  triggerEvent: "BOOKING_CONFIRMED",
  rewardType: "POINTS",
  rewardValue: 500,
  minBookingValue: null,
  bonusMultiplier: null,
  isActive: true,
  tierLevel: 1,
  ...over,
});

const partner = (over: Partial<PartnerInput> = {}): PartnerInput => ({
  code: "ABCD2345",
  isActive: true,
  payoutType: "POINTS",
  payoutValue: 500,
  payoutPercent: 0,
  ...over,
});

const base: PerksInput = { rules: [], partner: null, points: 0, hasBooking: true, preview: false, hasOpenRedemption: false };

describe("perk visibility: only what the team has configured", () => {
  it("hides referral rewards when no rule is configured", () => {
    const d = decidePerks(base);
    expect(d.showReferralRewards).toBe(false);
    expect(d.referralRewards).toEqual([]);
    expect(d.partner).toBeNull();
  });

  it("shows an active rule in the customer's words", () => {
    const d = decidePerks({ ...base, rules: [rule()] });
    expect(d.showReferralRewards).toBe(true);
    expect(d.referralRewards).toEqual([{ id: "r1", reward: "500 points", condition: "When a friend you introduce books with us" }]);
  });

  it("never shows an inactive rule", () => {
    const d = decidePerks({ ...base, rules: [rule({ isActive: false })] });
    expect(d.showReferralRewards).toBe(false);
  });

  it("drops rules the engine could never pay", () => {
    expect(describeReferralRule(rule({ rewardValue: 0 }))).toBeNull();
    expect(describeReferralRule(rule({ rewardType: "VOUCHER" }))).toBeNull();
    expect(describeReferralRule(rule({ triggerEvent: "SIGN_UP" }))).toBeNull();
    // processReferralRewards never matches HIGH_VALUE_BOOKING without a threshold.
    expect(describeReferralRule(rule({ triggerEvent: "HIGH_VALUE_BOOKING", minBookingValue: null }))).toBeNull();
  });

  it("applies the bonus multiplier exactly as the engine does", () => {
    expect(describeReferralRule(rule({ bonusMultiplier: 1.5 }))?.reward).toBe("750 points");
    expect(describeReferralRule(rule({ bonusMultiplier: 0 }))).toBeNull();
  });

  it("states the booking threshold in rupees", () => {
    expect(describeReferralRule(rule({ triggerEvent: "HIGH_VALUE_BOOKING", rewardType: "CASH", rewardValue: 2000, minBookingValue: 500000 }))).toEqual({
      id: "r1",
      reward: "₹2,000",
      condition: "When a friend you introduce books with us for ₹5,00,000 or more",
    });
  });

  it("reads discounts as percentages, as the rules screen does", () => {
    expect(describeReferralRule(rule({ rewardType: "DISCOUNT", rewardValue: 5 }))?.reward).toBe("5% discount");
    expect(describeReferralRule(rule({ rewardType: "DISCOUNT", rewardValue: 150 }))).toBeNull();
  });

  it("describes the repeat-referral rule", () => {
    expect(describeReferralRule(rule({ triggerEvent: "REPEAT_REFERRAL" }))?.condition).toBe("For each friend who books after your first successful introduction");
  });

  it("lists rewards in tier order and skips the unpayable ones", () => {
    const d = decidePerks({ ...base, rules: [rule({ id: "b", tierLevel: 2 }), rule({ id: "x", rewardValue: 0 }), rule({ id: "a", tierLevel: 1 })] });
    expect(d.referralRewards.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("shows the customer's own referral link only while it is active", () => {
    expect(decidePerks({ ...base, partner: partner() }).partner).toEqual({ code: "ABCD2345", reward: "500 points for each friend who books through your link" });
    expect(decidePerks({ ...base, partner: partner({ isActive: false }) }).partner).toBeNull();
  });

  it("keeps the link but promises nothing when its payout is zero", () => {
    expect(decidePerks({ ...base, partner: partner({ payoutType: "FLAT", payoutValue: 0 }) }).partner).toEqual({ code: "ABCD2345", reward: null });
  });

  it("describes flat and percentage payouts", () => {
    expect(describePartnerPayout(partner({ payoutType: "FLAT", payoutValue: 2500 }))).toBe("₹2,500 for each friend who books through your link");
    expect(describePartnerPayout(partner({ payoutType: "PERCENT", payoutPercent: 2.5 }))).toBe("2.5% of the booking value for each friend who books through your link");
    expect(describePartnerPayout(partner({ payoutType: "MYSTERY" }))).toBeNull();
  });
});

describe("requests to use points", () => {
  it("are off in staff preview", () => {
    expect(decidePerks({ ...base, points: 800, preview: true })).toMatchObject({ canRequestRedemption: false, redemptionBlockedReason: "PREVIEW" });
  });

  it("need a booking to attach to", () => {
    expect(decidePerks({ ...base, points: 800, hasBooking: false }).redemptionBlockedReason).toBe("NO_BOOKING");
  });

  it("need points", () => {
    expect(decidePerks({ ...base, points: 0 }).redemptionBlockedReason).toBe("NO_POINTS");
  });

  it("wait until the last request is settled", () => {
    expect(decidePerks({ ...base, points: 800, hasOpenRedemption: true }).redemptionBlockedReason).toBe("OPEN_REQUEST");
  });

  it("are open otherwise", () => {
    expect(decidePerks({ ...base, points: 800 })).toMatchObject({ canRequestRedemption: true, redemptionBlockedReason: null });
  });

  it("must be a whole number within the balance, with a note", () => {
    expect(validateRedemption({ points: 300, balance: 800, note: "  Valet   for guests " })).toEqual({ ok: true, points: 300, note: "Valet for guests" });
    expect(validateRedemption({ points: "300", balance: 800, note: "Valet" })).toMatchObject({ ok: true, points: 300 });
    expect(validateRedemption({ points: 12.5, balance: 800, note: "Valet" }).ok).toBe(false);
    expect(validateRedemption({ points: 0, balance: 800, note: "Valet" }).ok).toBe(false);
    expect(validateRedemption({ points: 900, balance: 800, note: "Valet" })).toEqual({ ok: false, error: "You have 800 points to use." });
    expect(validateRedemption({ points: 100, balance: 800, note: " " }).ok).toBe(false);
  });
});

describe("loyalty display matches the team's screens", () => {
  it("measures progress from the current tier's floor", () => {
    expect(tierProgress("BRONZE", 250)).toEqual({ nextTier: "SILVER", toGo: 250, pct: 50 });
    expect(tierProgress("GOLD", 3500)).toEqual({ nextTier: "PLATINUM", toGo: 1500, pct: 50 });
  });

  it("has nowhere to go from the top tier", () => {
    expect(tierProgress("PLATINUM", 9000)).toEqual({ nextTier: null, toGo: 0, pct: 100 });
  });

  it("does not invent progress for an unknown tier", () => {
    expect(tierProgress("DIAMOND", 9000)).toEqual({ nextTier: null, toGo: 0, pct: 0 });
  });

  it("signs points by what they do to the balance", () => {
    expect(signedPoints("EARNED", 500)).toBe(500);
    expect(signedPoints("REDEEMED", 300)).toBe(-300);
    expect(signedPoints("EXPIRED", 100)).toBe(-100);
    expect(signedPoints("ADJUSTED", -200)).toBe(-200);
    expect(signedPoints("ADJUSTED", 200)).toBe(200);
  });

  it("names tiers and referral statuses for customers", () => {
    expect(tierName("GOLD")).toBe("Gold");
    expect(referralStatusWord("LEAD_CREATED")).toBe("In conversation");
    expect(referralStatusWord("CONVERTED")).toBe("Booked");
  });
});
