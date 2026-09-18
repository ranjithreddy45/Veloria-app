import { customerLabel } from "@/lib/customer-app/status-labels";

// ============================================================
// Rewards screen decisions: which perks a customer may see, and how they read.
//
// Perks come ONLY from the team's own configuration:
//   - ReferralRewardRule rows (Settings > Referral reward rules), the rules
//     processReferralRewards() in referral-engine.actions.ts applies;
//   - the customer's own ReferralPartner link (/refer/<code>) and its payout.
// Loyalty points have no price list anywhere in the team's setup, so there are
// no fixed points perks: a customer asks their coordinator, who applies it.
// Tier thresholds mirror calculateTier() in loyalty.actions.ts and the team's
// loyalty account page.
// ============================================================

export interface RewardRuleInput {
  id: string;
  triggerEvent: string;
  rewardType: string;
  rewardValue: number;
  minBookingValue: number | null;
  bonusMultiplier: number | null;
  isActive: boolean;
  tierLevel: number;
}

export interface PartnerInput {
  code: string;
  isActive: boolean;
  payoutType: string;
  payoutValue: number;
  payoutPercent: number;
}

export interface PerkLine {
  id: string;
  /** "500 points", "₹2,000", "5% discount". */
  reward: string;
  /** When it applies, in the customer's words. */
  condition: string;
}

export type RedemptionBlock = "PREVIEW" | "NO_BOOKING" | "NO_POINTS" | "OPEN_REQUEST";

export interface PerksInput {
  rules: readonly RewardRuleInput[];
  partner: PartnerInput | null;
  points: number;
  hasBooking: boolean;
  preview: boolean;
  hasOpenRedemption: boolean;
}

export interface PerksDecision {
  referralRewards: PerkLine[];
  /** False when the team has nothing configured: the screen says so instead of listing perks. */
  showReferralRewards: boolean;
  partner: { code: string; reward: string | null } | null;
  canRequestRedemption: boolean;
  redemptionBlockedReason: RedemptionBlock | null;
}

function plainNumber(n: number): string {
  return Number(n.toFixed(2)).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function rupees(n: number): string {
  return `₹${plainNumber(n)}`;
}

function rewardText(type: string, value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  switch (type) {
    case "POINTS": {
      const pts = Math.round(value);
      return pts > 0 ? `${pts.toLocaleString("en-IN")} points` : null;
    }
    case "CASH":
      return rupees(value);
    case "DISCOUNT":
      // The rules screen labels this "Discount (%)".
      return value <= 100 ? `${plainNumber(value)}% discount` : null;
    default:
      return null;
  }
}

/** A configured rule in the customer's words, or null when the engine could never pay it. */
export function describeReferralRule(rule: RewardRuleInput): PerkLine | null {
  if (!rule.isActive) return null;
  // processReferralRewards multiplies whenever a multiplier is set, even 0.
  const value = rule.bonusMultiplier !== null ? rule.rewardValue * rule.bonusMultiplier : rule.rewardValue;
  const reward = rewardText(rule.rewardType, value);
  if (!reward) return null;
  const min = rule.minBookingValue !== null && rule.minBookingValue > 0 ? rule.minBookingValue : null;
  const whenFriendBooks = min
    ? `When a friend you introduce books with us for ${rupees(min)} or more`
    : "When a friend you introduce books with us";
  switch (rule.triggerEvent) {
    case "BOOKING_CONFIRMED":
      return { id: rule.id, reward, condition: whenFriendBooks };
    case "HIGH_VALUE_BOOKING":
      // The engine never matches this trigger without a threshold.
      return rule.minBookingValue === null ? null : { id: rule.id, reward, condition: whenFriendBooks };
    case "REPEAT_REFERRAL":
      return { id: rule.id, reward, condition: "For each friend who books after your first successful introduction" };
    default:
      return null;
  }
}

/** The payout on the customer's own referral link, or null when it pays nothing. */
export function describePartnerPayout(partner: PartnerInput): string | null {
  if (!partner.isActive) return null;
  switch (partner.payoutType) {
    case "POINTS": {
      // Same rounding as computePayoutPoints() in lib/referral/payout.ts.
      const pts = Math.max(0, Math.round(partner.payoutValue));
      return pts > 0 ? `${pts.toLocaleString("en-IN")} points for each friend who books through your link` : null;
    }
    case "FLAT":
      return partner.payoutValue > 0 ? `${rupees(partner.payoutValue)} for each friend who books through your link` : null;
    case "PERCENT":
      return partner.payoutPercent > 0 && partner.payoutPercent <= 100
        ? `${plainNumber(partner.payoutPercent)}% of the booking value for each friend who books through your link`
        : null;
    default:
      return null;
  }
}

export function decidePerks(input: PerksInput): PerksDecision {
  const referralRewards = [...input.rules]
    .sort((a, b) => a.tierLevel - b.tierLevel)
    .map((rule) => describeReferralRule(rule))
    .filter((line): line is PerkLine => line !== null);
  const partner =
    input.partner && input.partner.isActive
      ? { code: input.partner.code, reward: describePartnerPayout(input.partner) }
      : null;
  const redemptionBlockedReason: RedemptionBlock | null = input.preview
    ? "PREVIEW"
    : !input.hasBooking
      ? "NO_BOOKING"
      : input.points <= 0
        ? "NO_POINTS"
        : input.hasOpenRedemption
          ? "OPEN_REQUEST"
          : null;
  return {
    referralRewards,
    showReferralRewards: referralRewards.length > 0,
    partner,
    canRequestRedemption: redemptionBlockedReason === null,
    redemptionBlockedReason,
  };
}

export type RedemptionCheck = { ok: true; points: number; note: string } | { ok: false; error: string };

/** A request to use points: a whole number within the balance, and a note saying what for. */
export function validateRedemption(input: { points: unknown; balance: number; note: unknown }): RedemptionCheck {
  const points = typeof input.points === "number" ? input.points : Number(input.points);
  if (!Number.isInteger(points) || points <= 0) return { ok: false, error: "Enter a whole number of points." };
  if (points > input.balance) return { ok: false, error: `You have ${input.balance.toLocaleString("en-IN")} points to use.` };
  const note = String(input.note ?? "").replace(/\s+/g, " ").trim();
  if (note.length < 3) return { ok: false, error: "Tell your coordinator what you'd like to use them for." };
  return { ok: true, points, note: note.slice(0, 500) };
}

const LOYALTY_TIERS: { tier: string; min: number }[] = [
  { tier: "BRONZE", min: 0 },
  { tier: "SILVER", min: 500 },
  { tier: "GOLD", min: 2000 },
  { tier: "PLATINUM", min: 5000 },
];

const TIER_NAME: Record<string, string> = { BRONZE: "Bronze", SILVER: "Silver", GOLD: "Gold", PLATINUM: "Platinum" };

export function tierName(tier: string): string {
  return customerLabel(TIER_NAME, tier);
}

/** Mirrors getTierProgress() on the team's loyalty account page: from the stored tier's floor to the next tier, on lifetime points. */
export function tierProgress(tier: string, totalEarned: number): { nextTier: string | null; toGo: number; pct: number } {
  const idx = LOYALTY_TIERS.findIndex((t) => t.tier === tier);
  if (idx < 0) return { nextTier: null, toGo: 0, pct: 0 };
  const current = LOYALTY_TIERS[idx];
  const next = LOYALTY_TIERS[idx + 1];
  if (!next) return { nextTier: null, toGo: 0, pct: 100 };
  const pct = Math.round(((totalEarned - current.min) / (next.min - current.min)) * 100);
  return { nextTier: next.tier, toGo: Math.max(next.min - totalEarned, 0), pct: Math.max(0, Math.min(pct, 100)) };
}

/** Points as they move the balance: earnings add, redemptions and expiries subtract, adjustments keep their sign. */
export function signedPoints(type: string, points: number): number {
  const abs = Math.abs(points);
  if (type === "EARNED") return abs;
  if (type === "REDEEMED" || type === "EXPIRED") return -abs;
  return points;
}

// Not yet in status-labels.ts; move there when that file is next opened.
const REFERRAL_STATUS_WORDS: Record<string, string> = {
  PENDING: "Received",
  CONTACTED: "Contacted",
  LEAD_CREATED: "In conversation",
  BOOKING_CONFIRMED: "Booked",
  CONVERTED: "Booked",
  EXPIRED: "Lapsed",
  CANCELLED: "Closed",
};

export function referralStatusWord(status: string): string {
  return customerLabel(REFERRAL_STATUS_WORDS, status);
}
