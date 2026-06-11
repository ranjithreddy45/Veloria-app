import { describe, it, expect } from "vitest";
import {
  normalizeMobile,
  computeEvaluation,
  isLegalTransition,
  LEGAL_TRANSITIONS,
  evaluateQualification,
  canDisqualify,
  requiresBdHeadApproval,
  shouldReengage,
  type EvaluationScores,
} from "./domain";
import { ACQ_DEAL_STAGE } from "./constants";

// ============================================================
// §5.5 Mobile normalization
// ============================================================
describe("normalizeMobile", () => {
  it("prepends +91 to a 10-digit Indian number", () => {
    expect(normalizeMobile("9845011223")).toBe("+919845011223");
  });
  it("strips a leading 0", () => {
    expect(normalizeMobile("09845011223")).toBe("+919845011223");
  });
  it("strips spaces, dashes and parentheses", () => {
    expect(normalizeMobile("+91 98450-11223")).toBe("+919845011223");
    expect(normalizeMobile("98450 11223")).toBe("+919845011223");
  });
  it("keeps an existing country code", () => {
    expect(normalizeMobile("919845011223")).toBe("+919845011223");
    expect(normalizeMobile("+14155550100")).toBe("+14155550100");
  });
  it("two formats of the same number normalize equal (dedup safety)", () => {
    expect(normalizeMobile("098450 11223")).toBe(normalizeMobile("+919845011223"));
  });
});

// ============================================================
// §5.3 Evaluation scorecard
// ============================================================
describe("computeEvaluation", () => {
  const perfect: EvaluationScores = {
    capacityScore: 5, parkingScore: 5, kitchenScore: 5, roomsScore: 5,
    conditionScore: 5, locationScore: 5, avAmenitiesScore: 5,
  };
  it("scores a perfect card at 100 and passes", () => {
    const r = computeEvaluation(perfect);
    expect(r.totalScore).toBe(100);
    expect(r.passed).toBe(true);
  });
  it("computes the weighted normalized score exactly", () => {
    // all 3s: weighted = 3*(4+3+2+2+4+3+2)=3*20=60 → 60
    const r = computeEvaluation({
      capacityScore: 3, parkingScore: 3, kitchenScore: 3, roomsScore: 3,
      conditionScore: 3, locationScore: 3, avAmenitiesScore: 3,
    });
    expect(r.totalScore).toBe(60);
    expect(r.passed).toBe(false); // below 70
  });
  it("passes at >=70 with all high-weight criteria >=3", () => {
    // capacity5 parking4 kitchen3 rooms3 condition5 location4 av3
    // weighted = 4*5+3*4+2*3+2*3+4*5+3*4+2*3 = 20+12+6+6+20+12+6 = 82
    const r = computeEvaluation({
      capacityScore: 5, parkingScore: 4, kitchenScore: 3, roomsScore: 3,
      conditionScore: 5, locationScore: 4, avAmenitiesScore: 3,
    });
    expect(r.totalScore).toBe(82);
    expect(r.passed).toBe(true);
  });
  it("FAILS when a high-weight criterion < 3 even if total >= 70", () => {
    // parking=2 (high-weight) but pump others high
    // weighted = 4*5+3*2+2*5+2*5+4*5+3*5+2*5 = 20+6+10+10+20+15+10 = 91
    const r = computeEvaluation({
      capacityScore: 5, parkingScore: 2, kitchenScore: 5, roomsScore: 5,
      conditionScore: 5, locationScore: 5, avAmenitiesScore: 5,
    });
    expect(r.totalScore).toBe(91);
    expect(r.passed).toBe(false); // high-weight parking < 3
  });
  it("allows a medium-weight criterion < 3 if total still >= 70", () => {
    // kitchen=1, rooms=1, av=1 (all medium), highs all 5
    // weighted = 4*5+3*5+2*1+2*1+4*5+3*5+2*1 = 20+15+2+2+20+15+2 = 76
    const r = computeEvaluation({
      capacityScore: 5, parkingScore: 5, kitchenScore: 1, roomsScore: 1,
      conditionScore: 5, locationScore: 5, avAmenitiesScore: 1,
    });
    expect(r.totalScore).toBe(76);
    expect(r.passed).toBe(true);
  });
});

// ============================================================
// §4.1 Legal transitions
// ============================================================
describe("isLegalTransition", () => {
  it("allows the canonical happy path", () => {
    expect(isLegalTransition("QUALIFIED", "EVALUATION")).toBe(true);
    expect(isLegalTransition("EVALUATION", "EVALUATION_COMPLETED")).toBe(true);
    expect(isLegalTransition("EVALUATION_COMPLETED", "PROPOSAL_SENT")).toBe(true);
    expect(isLegalTransition("PROPOSAL_SENT", "NEGOTIATION")).toBe(true);
    expect(isLegalTransition("NEGOTIATION", "CONTRACT_SENT")).toBe(true);
    expect(isLegalTransition("CONTRACT_SENT", "SIGNED")).toBe(true);
    expect(isLegalTransition("SIGNED", "WON")).toBe(true);
  });
  it("allows CONTRACT_SENT back to NEGOTIATION", () => {
    expect(isLegalTransition("CONTRACT_SENT", "NEGOTIATION")).toBe(true);
  });
  it("allows ON_HOLD to re-enter EVALUATION", () => {
    expect(isLegalTransition("ON_HOLD", "EVALUATION")).toBe(true);
  });
  it("rejects skipping stages", () => {
    expect(isLegalTransition("QUALIFIED", "PROPOSAL_SENT")).toBe(false);
    expect(isLegalTransition("EVALUATION", "WON")).toBe(false);
    expect(isLegalTransition("QUALIFIED", "WON")).toBe(false);
  });
  it("treats WON and LOST as terminal", () => {
    expect(LEGAL_TRANSITIONS.WON).toEqual([]);
    expect(LEGAL_TRANSITIONS.LOST).toEqual([]);
  });
  it("every stage in the canonical list has a transition entry", () => {
    for (const s of ACQ_DEAL_STAGE) {
      expect(LEGAL_TRANSITIONS[s]).toBeDefined();
    }
  });
});

// ============================================================
// §5.2 Qualification gate
// ============================================================
describe("evaluateQualification", () => {
  const allTrue = {
    is_decision_maker: true,
    venue_operational_within_60d: true,
    open_to_revenue_share_model: true,
    no_competitor_exclusivity: true,
  };
  it("qualifies only when all four are true", () => {
    expect(evaluateQualification(allTrue).qualified).toBe(true);
  });
  it("rejects when any is false and lists the failures", () => {
    const r = evaluateQualification({ ...allTrue, open_to_revenue_share_model: false });
    expect(r.qualified).toBe(false);
    expect(r.failed).toContain("open_to_revenue_share_model");
    expect(r.suggestedDisqualifyReason).toBe("WANTS_OUTRIGHT_RENT_ONLY");
  });
  it("maps non-decision-maker to the right reason", () => {
    const r = evaluateQualification({ ...allTrue, is_decision_maker: false });
    expect(r.suggestedDisqualifyReason).toBe("NOT_DECISION_MAKER");
  });
});

// ============================================================
// §5.1 Disqualify window
// ============================================================
describe("canDisqualify", () => {
  const created = new Date("2026-01-01T10:00:00Z");
  it("blocks disqualify with <3 attempts inside the 5-day window for a normal reason", () => {
    const now = new Date("2026-01-02T10:00:00Z");
    expect(canDisqualify("UNREALISTIC_EXPECTATIONS", { contactAttempts: 1, createdAt: created, now })).toBe(false);
  });
  it("allows after 3 attempts even inside the window", () => {
    const now = new Date("2026-01-02T10:00:00Z");
    expect(canDisqualify("UNREALISTIC_EXPECTATIONS", { contactAttempts: 3, createdAt: created, now })).toBe(true);
  });
  it("allows after the 5-day window even with few attempts", () => {
    const now = new Date("2026-01-07T10:00:00Z");
    expect(canDisqualify("NO_RESPONSE_5_DAYS", { contactAttempts: 0, createdAt: created, now })).toBe(true);
  });
  it("always allows first-contact-valid reasons immediately", () => {
    const now = new Date("2026-01-01T11:00:00Z");
    for (const reason of ["NOT_DECISION_MAKER", "COMPETITOR_EXCLUSIVE", "OUT_OF_GEOGRAPHY", "VENUE_NOT_OPERATIONAL"] as const) {
      expect(canDisqualify(reason, { contactAttempts: 0, createdAt: created, now })).toBe(true);
    }
  });
});

// ============================================================
// §5.4 Commercial floor → BD Head approval
// ============================================================
describe("requiresBdHeadApproval", () => {
  it("requires approval when lock-in is below the minimum", () => {
    expect(requiresBdHeadApproval({ model: "MANAGEMENT", baseFeePct: 8, incentivePct: 18, royaltyPct: null, lockinYears: 2 })).toBe(true);
  });
  it("requires approval when a management fee is below floor", () => {
    expect(requiresBdHeadApproval({ model: "MANAGEMENT", baseFeePct: 4, incentivePct: 18, royaltyPct: null, lockinYears: 5 })).toBe(true);
    expect(requiresBdHeadApproval({ model: "MANAGEMENT", baseFeePct: 8, incentivePct: 10, royaltyPct: null, lockinYears: 5 })).toBe(true);
  });
  it("requires approval when franchise royalty is below floor", () => {
    expect(requiresBdHeadApproval({ model: "FRANCHISE", baseFeePct: null, incentivePct: null, royaltyPct: 18, lockinYears: 5 })).toBe(true);
  });
  it("does not require approval when everything is at/above floor", () => {
    expect(requiresBdHeadApproval({ model: "MANAGEMENT", baseFeePct: 5, incentivePct: 15, royaltyPct: null, lockinYears: 3 })).toBe(false);
    expect(requiresBdHeadApproval({ model: "FRANCHISE", baseFeePct: null, incentivePct: null, royaltyPct: 20, lockinYears: 3 })).toBe(false);
  });
});

// ============================================================
// §6.3 Re-engagement
// ============================================================
describe("shouldReengage", () => {
  it("re-engages for HIGH_COMMISSION and COMPETITOR_SELECTED", () => {
    expect(shouldReengage("HIGH_COMMISSION")).toBe(true);
    expect(shouldReengage("COMPETITOR_SELECTED")).toBe(true);
  });
  it("does not re-engage for other reasons", () => {
    expect(shouldReengage("VENUE_QUALITY_BELOW_STANDARD")).toBe(false);
    expect(shouldReengage("BUDGET_PRICING")).toBe(false);
  });
});
