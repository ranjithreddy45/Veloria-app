// ============================================================
// BD / Acquisition CRM — single source of truth for enums + config.
// Mirrors the Prisma enums exactly (do not introduce synonyms).
// Shared by API and UI so they cannot drift.
// ============================================================

export const ACQ_LEAD_STATUS = ["NEW", "CONTACTED", "QUALIFIED", "DISQUALIFIED"] as const;
export type AcqLeadStatus = (typeof ACQ_LEAD_STATUS)[number];

export const ACQ_OWNER_TYPE = ["SOLE_OWNER", "PARTNER", "GPA_HOLDER", "MANAGER"] as const;
export type AcqOwnerType = (typeof ACQ_OWNER_TYPE)[number];

export const ACQ_PROPERTY_TYPE = ["BANQUET", "MARRIAGE_HALL", "CONVENTION_CENTRE", "RESORT", "LAWN"] as const;
export type AcqPropertyType = (typeof ACQ_PROPERTY_TYPE)[number];

export const ACQ_LEAD_SOURCE = ["WEBSITE", "REFERRAL", "BROKER", "COLD_CALL", "SOCIAL_MEDIA", "WALK_IN", "OTHER"] as const;
export type AcqLeadSource = (typeof ACQ_LEAD_SOURCE)[number];

// Canonical deal stage machine — ORDERED.
export const ACQ_DEAL_STAGE = [
  "QUALIFIED",
  "EVALUATION",
  "EVALUATION_COMPLETED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "CONTRACT_SENT",
  "SIGNED",
  "WON",
  "LOST",
  "ON_HOLD",
] as const;
export type AcqDealStage = (typeof ACQ_DEAL_STAGE)[number];

export const ACQ_DEAL_MODEL = ["MANAGEMENT", "FRANCHISE"] as const;
export type AcqDealModel = (typeof ACQ_DEAL_MODEL)[number];

export const ACQ_CONTRACT_STATUS = ["NOT_SENT", "SENT", "SIGNED"] as const;
export type AcqContractStatus = (typeof ACQ_CONTRACT_STATUS)[number];

export const ACQ_PROPERTY_STATUS = ["ONBOARDING", "AVAILABLE", "ACTIVE", "PAUSED", "OFF_BOARDED"] as const;
export type AcqPropertyStatus = (typeof ACQ_PROPERTY_STATUS)[number];

export const ACQ_DISQUALIFY_REASON = [
  "WANTS_OUTRIGHT_RENT_ONLY",
  "COMPETITOR_EXCLUSIVE",
  "VENUE_NOT_OPERATIONAL",
  "NOT_DECISION_MAKER",
  "UNREALISTIC_EXPECTATIONS",
  "NO_RESPONSE_5_DAYS",
  "OUT_OF_GEOGRAPHY",
  "OTHER",
] as const;
export type AcqDisqualifyReason = (typeof ACQ_DISQUALIFY_REASON)[number];

export const ACQ_LOST_REASON = [
  "HIGH_COMMISSION",
  "COMPETITOR_SELECTED",
  "WANTED_OUTRIGHT_RENT",
  "LOCKIN_TOO_LONG",
  "BUDGET_PRICING",
  "NO_RESPONSE",
  "VENUE_QUALITY_BELOW_STANDARD",
  "OTHER",
] as const;
export type AcqLostReason = (typeof ACQ_LOST_REASON)[number];

// Reasons valid to disqualify on first contact (bypass the 3-attempt / 5-day window).
export const FIRST_CONTACT_VALID_DISQUALIFY_REASONS: ReadonlySet<AcqDisqualifyReason> = new Set([
  "NOT_DECISION_MAKER",
  "COMPETITOR_EXCLUSIVE",
  "OUT_OF_GEOGRAPHY",
  "VENUE_NOT_OPERATIONAL",
]);

// Lost reasons that trigger a 90-day re-engagement.
export const REENGAGE_LOST_REASONS: ReadonlySet<AcqLostReason> = new Set([
  "HIGH_COMMISSION",
  "COMPETITOR_SELECTED",
]);

// ---- Config defaults (Appendix A) ----
export const ACQ_CONFIG_DEFAULTS = {
  MANAGEMENT_BASE_FEE_FLOOR_PCT: 5,
  MANAGEMENT_INCENTIVE_FLOOR_PCT: 15,
  FRANCHISE_ROYALTY_FLOOR_PCT: 20,
  MIN_LOCKIN_YEARS: 3,
  LEAD_FIRST_CONTACT_SLA_HOURS: 24,
  LEAD_MIN_ATTEMPTS_BEFORE_DISQUALIFY: 3,
  LEAD_DISQUALIFY_WINDOW_DAYS: 5,
  ONBOARDING_SLA_DAYS: 7,
  REENGAGE_DAYS: 90,
  EVALUATION_PASS_THRESHOLD: 70,
} as const;
export type AcqConfigKey = keyof typeof ACQ_CONFIG_DEFAULTS;

// The six seed onboarding tasks created on WON (§6.1).
export const ONBOARDING_SEED_TASKS = [
  "Upload property images",
  "Verify ownership documents",
  "Configure pricing",
  "Add amenities",
  "Assign Property Manager",
  "Brand-standard audit",
] as const;

// ---- Display labels ----
export const ACQ_DEAL_STAGE_LABEL: Record<AcqDealStage, string> = {
  QUALIFIED: "Qualified",
  EVALUATION: "Evaluation",
  EVALUATION_COMPLETED: "Evaluation Done",
  PROPOSAL_SENT: "Proposal Sent",
  NEGOTIATION: "Negotiation",
  CONTRACT_SENT: "Contract Sent",
  SIGNED: "Signed",
  WON: "Won",
  LOST: "Lost",
  ON_HOLD: "On Hold",
};

export const ACQ_PROPERTY_TYPE_LABEL: Record<AcqPropertyType, string> = {
  BANQUET: "Banquet",
  MARRIAGE_HALL: "Marriage Hall",
  CONVENTION_CENTRE: "Convention Centre",
  RESORT: "Resort",
  LAWN: "Lawn",
};
