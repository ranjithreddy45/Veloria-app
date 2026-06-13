// ============================================================
// BD / Acquisition CRM — pure domain logic.
// No DB, no IO. Everything here is unit-tested and is the
// single source of truth for the rules in the spec (§4–§6).
// ============================================================

import {
  type AcqDealStage,
  type AcqDisqualifyReason,
  type AcqLostReason,
  type AcqDealModel,
  FIRST_CONTACT_VALID_DISQUALIFY_REASONS,
  REENGAGE_LOST_REASONS,
  ACQ_CONFIG_DEFAULTS,
} from "./constants";

// ------------------------------------------------------------
// §5.5 — Mobile normalization to E.164 (India default).
// ------------------------------------------------------------
export function normalizeMobile(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");

  if (hasPlus) {
    // Already has a country code.
    return "+" + digits;
  }
  // Strip a leading 0 (domestic trunk prefix).
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  // 10-digit Indian mobile → prepend +91.
  if (digits.length === 10) return "+91" + digits;
  // 12 digits starting with 91 → already country-coded.
  if (digits.length === 12 && digits.startsWith("91")) return "+" + digits;
  // Fallback: return with a plus so comparisons are stable.
  return "+" + digits;
}

// A mobile is valid only if it carries a plausible number of digits (10 local up
// to 15 for E.164 with country code). Guards against garbage like "abcdef" that
// would normalise to "+" and silently defeat dedup. Used client- and server-side.
export function isValidMobile(raw: string): boolean {
  const digits = (raw || "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

// ------------------------------------------------------------
// §5.3 — Evaluation scorecard (numeric model, exact).
// ------------------------------------------------------------
export interface EvaluationScores {
  capacityScore: number;
  parkingScore: number;
  kitchenScore: number;
  roomsScore: number;
  conditionScore: number;
  locationScore: number;
  avAmenitiesScore: number;
}

export interface EvaluationResult {
  totalScore: number; // 0–100
  passed: boolean;
}

/** High-weight criteria that must each individually score >= 3 to pass. */
const HIGH_WEIGHT_KEYS: (keyof EvaluationScores)[] = [
  "capacityScore",
  "parkingScore",
  "conditionScore",
  "locationScore",
];

export function computeEvaluation(
  s: EvaluationScores,
  passThreshold: number = ACQ_CONFIG_DEFAULTS.EVALUATION_PASS_THRESHOLD
): EvaluationResult {
  const weighted =
    4 * s.capacityScore +
    3 * s.parkingScore +
    2 * s.kitchenScore +
    2 * s.roomsScore +
    4 * s.conditionScore +
    3 * s.locationScore +
    2 * s.avAmenitiesScore;
  const max = 20 * 5; // 100
  const totalScore = Math.round((weighted / max) * 100);

  const allHighOk = HIGH_WEIGHT_KEYS.every((k) => s[k] >= 3);
  const passed = totalScore >= passThreshold && allHighOk;
  return { totalScore, passed };
}

export function isValidScore(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5;
}

// ------------------------------------------------------------
// §4.1 — Legal deal-stage transitions.
// ------------------------------------------------------------
export const LEGAL_TRANSITIONS: Record<AcqDealStage, AcqDealStage[]> = {
  QUALIFIED: ["EVALUATION", "LOST", "ON_HOLD"],
  EVALUATION: ["EVALUATION_COMPLETED", "ON_HOLD", "LOST"],
  EVALUATION_COMPLETED: ["PROPOSAL_SENT", "LOST"],
  PROPOSAL_SENT: ["NEGOTIATION", "LOST"],
  NEGOTIATION: ["CONTRACT_SENT", "LOST"],
  CONTRACT_SENT: ["SIGNED", "NEGOTIATION", "LOST"],
  SIGNED: ["WON"],
  WON: [],
  LOST: [],
  ON_HOLD: ["EVALUATION", "LOST"],
};

export function isLegalTransition(from: AcqDealStage, to: AcqDealStage): boolean {
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false;
}

// ------------------------------------------------------------
// §5.2 — Lead → Deal qualification gate (4-point).
// ------------------------------------------------------------
// Qualification gate (§ qualify). ALL four must be true to qualify a lead:
//   A. seating capacity 100+
//   B. landlord/owner interested in the Veloria management model
//   C. agrees to renovate the venue if required
//   D. pictures (interiors, exterior, washrooms, dressing rooms) available
export interface QualificationPayload {
  seating_100_plus: boolean;
  owner_interested_in_management_model: boolean;
  agrees_to_renovate_if_required: boolean;
  required_photos_available: boolean;
}

export interface QualificationResult {
  qualified: boolean;
  failed: string[];
  /** Suggested disqualify reason mapped from the first failed gate. */
  suggestedDisqualifyReason: AcqDisqualifyReason | null;
}

export function evaluateQualification(p: QualificationPayload): QualificationResult {
  const failed: string[] = [];
  if (!p.seating_100_plus) failed.push("seating_100_plus");
  if (!p.owner_interested_in_management_model) failed.push("owner_interested_in_management_model");
  if (!p.agrees_to_renovate_if_required) failed.push("agrees_to_renovate_if_required");
  if (!p.required_photos_available) failed.push("required_photos_available");

  let suggested: AcqDisqualifyReason | null = null;
  if (failed.length > 0) {
    const first = failed[0];
    const map: Record<string, AcqDisqualifyReason> = {
      owner_interested_in_management_model: "WANTS_OUTRIGHT_RENT_ONLY",
      seating_100_plus: "OTHER",
      agrees_to_renovate_if_required: "OTHER",
      required_photos_available: "OTHER",
    };
    suggested = map[first] ?? "OTHER";
  }
  return { qualified: failed.length === 0, failed, suggestedDisqualifyReason: suggested };
}

// ------------------------------------------------------------
// §5.1 — Lead disqualification window rule.
// ------------------------------------------------------------
export interface DisqualifyContext {
  contactAttempts: number;
  createdAt: Date;
  now: Date;
  minAttempts?: number; // default from config
  windowDays?: number; // default from config
}

/**
 * Returns true if the lead MAY be disqualified for the given reason.
 * Blocked while attempts < min AND within the window, unless the reason
 * is valid on first contact.
 */
export function canDisqualify(reason: AcqDisqualifyReason, ctx: DisqualifyContext): boolean {
  if (FIRST_CONTACT_VALID_DISQUALIFY_REASONS.has(reason)) return true;
  const minAttempts = ctx.minAttempts ?? ACQ_CONFIG_DEFAULTS.LEAD_MIN_ATTEMPTS_BEFORE_DISQUALIFY;
  const windowDays = ctx.windowDays ?? ACQ_CONFIG_DEFAULTS.LEAD_DISQUALIFY_WINDOW_DAYS;
  const windowEnd = new Date(ctx.createdAt.getTime() + windowDays * 24 * 60 * 60 * 1000);
  const withinWindow = ctx.now < windowEnd;
  const tooFewAttempts = ctx.contactAttempts < minAttempts;
  // Blocked only when BOTH too-few-attempts AND still within the window.
  return !(tooFewAttempts && withinWindow);
}

// ------------------------------------------------------------
// §5.4 — Commercial floor → BD Head approval requirement.
// ------------------------------------------------------------
export interface DealCommercials {
  model: AcqDealModel | null;
  baseFeePct: number | null;
  incentivePct: number | null;
  royaltyPct: number | null;
  lockinYears: number | null;
}

export interface FloorConfig {
  MANAGEMENT_BASE_FEE_FLOOR_PCT: number;
  MANAGEMENT_INCENTIVE_FLOOR_PCT: number;
  FRANCHISE_ROYALTY_FLOOR_PCT: number;
  MIN_LOCKIN_YEARS: number;
}

export function defaultFloorConfig(): FloorConfig {
  return {
    MANAGEMENT_BASE_FEE_FLOOR_PCT: ACQ_CONFIG_DEFAULTS.MANAGEMENT_BASE_FEE_FLOOR_PCT,
    MANAGEMENT_INCENTIVE_FLOOR_PCT: ACQ_CONFIG_DEFAULTS.MANAGEMENT_INCENTIVE_FLOOR_PCT,
    FRANCHISE_ROYALTY_FLOOR_PCT: ACQ_CONFIG_DEFAULTS.FRANCHISE_ROYALTY_FLOOR_PCT,
    MIN_LOCKIN_YEARS: ACQ_CONFIG_DEFAULTS.MIN_LOCKIN_YEARS,
  };
}

/** True when the deal is below a floor or lock-in and needs BD Head approval before CONTRACT_SENT. */
export function requiresBdHeadApproval(d: DealCommercials, cfg: FloorConfig = defaultFloorConfig()): boolean {
  if (d.lockinYears != null && d.lockinYears < cfg.MIN_LOCKIN_YEARS) return true;
  if (d.model === "MANAGEMENT") {
    if (d.baseFeePct != null && d.baseFeePct < cfg.MANAGEMENT_BASE_FEE_FLOOR_PCT) return true;
    if (d.incentivePct != null && d.incentivePct < cfg.MANAGEMENT_INCENTIVE_FLOOR_PCT) return true;
  }
  if (d.model === "FRANCHISE") {
    if (d.royaltyPct != null && d.royaltyPct < cfg.FRANCHISE_ROYALTY_FLOOR_PCT) return true;
  }
  return false;
}

/** §6.3 — does this lost reason trigger a 90-day re-engagement? */
export function shouldReengage(reason: AcqLostReason): boolean {
  return REENGAGE_LOST_REASONS.has(reason);
}

// ------------------------------------------------------------
// Working-hours helper for first-contact SLA (§5.1 / Appendix).
// Adds N working hours (Mon–Sat, 9:00–18:00 IST-agnostic clock).
// ------------------------------------------------------------
export function addWorkingHours(start: Date, hours: number): Date {
  const WORK_START = 9;
  const WORK_END = 18;
  const PER_DAY = WORK_END - WORK_START; // 9 working hours/day
  let remaining = hours;
  const cur = new Date(start.getTime());

  // Move into working hours if outside.
  const inWindow = (d: Date) => {
    const day = d.getDay(); // 0=Sun
    const h = d.getHours();
    return day !== 0 && h >= WORK_START && h < WORK_END;
  };
  const advanceToNextWorkStart = (d: Date) => {
    do {
      d.setHours(WORK_START, 0, 0, 0);
      if (d <= cur || d.getDay() === 0 || cur.getHours() >= WORK_END) {
        d.setDate(d.getDate() + (d <= cur ? 1 : 0));
      }
      if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    } while (d.getDay() === 0);
  };

  if (!inWindow(cur)) {
    if (cur.getDay() === 0 || cur.getHours() >= WORK_END) {
      cur.setDate(cur.getDate() + 1);
      advanceToNextWorkStart(cur);
    } else if (cur.getHours() < WORK_START) {
      cur.setHours(WORK_START, 0, 0, 0);
    }
  }

  while (remaining > 0) {
    if (cur.getDay() === 0) {
      cur.setDate(cur.getDate() + 1);
      cur.setHours(WORK_START, 0, 0, 0);
      continue;
    }
    const hoursLeftToday = WORK_END - cur.getHours() - cur.getMinutes() / 60;
    if (remaining <= hoursLeftToday) {
      cur.setTime(cur.getTime() + remaining * 60 * 60 * 1000);
      remaining = 0;
    } else {
      remaining -= hoursLeftToday;
      cur.setDate(cur.getDate() + 1);
      cur.setHours(WORK_START, 0, 0, 0);
    }
  }
  void PER_DAY;
  return cur;
}
