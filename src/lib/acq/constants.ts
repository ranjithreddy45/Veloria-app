// ============================================================
// BD / Acquisition CRM — single source of truth for enums + config.
// Mirrors the Prisma enums exactly (do not introduce synonyms).
// Shared by API and UI so they cannot drift.
// ============================================================

// ORDERED as the lead travels: NEW → CONTACTED → QUALIFIED → DEAL_CREATED,
// with DISQUALIFIED as the drop-out. DEAL_CREATED exists so the inbox can tell a
// lead that merely passed the qualification gate from one that already has a
// deal behind it (qualifyAcqLead creates the deal, so it lands on DEAL_CREATED).
export const ACQ_LEAD_STATUS = ["NEW", "CONTACTED", "QUALIFIED", "DEAL_CREATED", "DISQUALIFIED"] as const;
export type AcqLeadStatus = (typeof ACQ_LEAD_STATUS)[number];

/**
 * Statuses a user may switch to DIRECTLY from the lead UI, keyed by the current
 * status. Deliberately excludes QUALIFIED / DEAL_CREATED / DISQUALIFIED: those
 * carry side effects and their own gates (qualification checklist + deal
 * creation in qualifyAcqLead; a reason + the attempts/window rule in
 * disqualifyAcqLead), so they must be reached through those actions, never by a
 * plain status write. DISQUALIFIED → NEW/CONTACTED is allowed so a lead dropped
 * by mistake can be reopened; a lead with a deal behind it is frozen.
 */
export const ACQ_LEAD_STATUS_TRANSITIONS: Record<AcqLeadStatus, readonly AcqLeadStatus[]> = {
  NEW: ["CONTACTED"],
  CONTACTED: ["NEW"],
  QUALIFIED: [],
  DEAL_CREATED: [],
  DISQUALIFIED: ["NEW", "CONTACTED"],
};

export const ACQ_OWNER_TYPE = ["SOLE_OWNER", "PARTNER", "GPA_HOLDER", "MANAGER"] as const;
export type AcqOwnerType = (typeof ACQ_OWNER_TYPE)[number];

export const ACQ_PROPERTY_TYPE = ["BANQUET", "MARRIAGE_HALL", "CONVENTION_CENTRE", "RESORT", "LAWN"] as const;
export type AcqPropertyType = (typeof ACQ_PROPERTY_TYPE)[number];

// SELECTABLE lead sources. "WALK_IN" was renamed to "INCOMING_LEAD" and is no
// longer offered anywhere; the Prisma enum still declares it so historic rows
// stay readable until prisma/bootstrap.ts migrates them (it runs every deploy).
export const ACQ_LEAD_SOURCE = ["WEBSITE", "REFERRAL", "BROKER", "COLD_CALL", "SOCIAL_MEDIA", "INCOMING_LEAD", "OTHER"] as const;
export type AcqLeadSource = (typeof ACQ_LEAD_SOURCE)[number];

/** The retired value, kept only so writes coming from a stale form still land. */
export const ACQ_LEAD_SOURCE_RETIRED = "WALK_IN" as const;

// Keyed by string (not AcqLeadSource) on purpose: it must also carry the retired
// WALK_IN so a not-yet-migrated row never renders as a raw enum token.
export const ACQ_LEAD_SOURCE_LABEL: Record<string, string> = {
  WEBSITE: "Website",
  REFERRAL: "Referral",
  BROKER: "Broker",
  COLD_CALL: "Cold call",
  SOCIAL_MEDIA: "Social media",
  INCOMING_LEAD: "Incoming lead",
  WALK_IN: "Incoming lead", // legacy rows read as the new name
  OTHER: "Other",
};

export const ACQ_PROPERTY_STAGE = ["OPERATIONAL", "CONVERSION", "BROWNFIELD", "GREENFIELD"] as const;
export type AcqPropertyStage = (typeof ACQ_PROPERTY_STAGE)[number];

// ---- Contracts (CLM) ----
export const ACQ_CONTRACT_PHASE = ["AUTHORING", "APPROVAL", "NEGOTIATION", "EXECUTION", "POST_EXECUTION"] as const;
export type AcqContractPhase = (typeof ACQ_CONTRACT_PHASE)[number];

export const ACQ_CONTRACT_LIFECYCLE = ["DRAFT", "APPROVED", "NEGOTIATED", "SIGNED", "ACTIVE", "TERMINATED"] as const;
export type AcqContractLifecycle = (typeof ACQ_CONTRACT_LIFECYCLE)[number];

export const ACQ_CONTRACT_PHASE_LABEL: Record<AcqContractPhase, string> = {
  AUTHORING: "Authoring",
  APPROVAL: "Approval",
  NEGOTIATION: "Negotiation",
  EXECUTION: "Execution",
  POST_EXECUTION: "Post-Execution",
};

export const ACQ_CONTRACT_LIFECYCLE_LABEL: Record<AcqContractLifecycle, string> = {
  DRAFT: "Draft",
  APPROVED: "Approved",
  NEGOTIATED: "Negotiated",
  SIGNED: "Signed",
  ACTIVE: "Active",
  TERMINATED: "Terminated",
};

// RETIRED from the lead UI: the bucketed range duplicated the exact
// seatingTheatre / seatingFloating numbers, so the lead create/edit forms,
// filters and display now use only the exact numbers and never write this
// column. Kept here (and in the DB) so stored historic values still render.
export const ACQ_SEATING_RANGE = ["R_50_100", "R_100_150", "R_150_200", "R_200_300", "R_300_500", "R_500_PLUS"] as const;
export type AcqSeatingRange = (typeof ACQ_SEATING_RANGE)[number];

export const ACQ_LEAD_STATUS_LABEL: Record<AcqLeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  DEAL_CREATED: "Deal created",
  DISQUALIFIED: "Dropped",
};

// StatusPill hue per lead status — one map so the inbox, the detail header and
// any future surface can never drift. DEAL_CREATED is indigo (not emerald) so it
// is visually distinct from a merely-qualified lead at a glance.
export const ACQ_LEAD_STATUS_HUE: Record<
  AcqLeadStatus,
  "slate" | "blue" | "emerald" | "indigo" | "rose"
> = {
  NEW: "slate",
  CONTACTED: "blue",
  QUALIFIED: "emerald",
  DEAL_CREATED: "indigo",
  DISQUALIFIED: "rose",
};

// ---- Lead contacts (several people per property: owner, manager, accountant…) ----
export const ACQ_CONTACT_DESIGNATION = [
  "OWNER",
  "CO_OWNER",
  "MANAGER",
  "ACCOUNTANT",
  "CARETAKER",
  "BROKER",
  "OTHER",
] as const;
export type AcqContactDesignation = (typeof ACQ_CONTACT_DESIGNATION)[number];

export const ACQ_CONTACT_DESIGNATION_LABEL: Record<AcqContactDesignation, string> = {
  OWNER: "Owner",
  CO_OWNER: "Co-owner",
  MANAGER: "Manager",
  ACCOUNTANT: "Accountant",
  CARETAKER: "Caretaker",
  BROKER: "Broker",
  OTHER: "Other",
};

export const ACQ_PROPERTY_STAGE_LABEL: Record<AcqPropertyStage, string> = {
  OPERATIONAL: "Operational",
  CONVERSION: "Conversion",
  BROWNFIELD: "Brownfield",
  GREENFIELD: "Greenfield",
};

export const ACQ_SEATING_RANGE_LABEL: Record<AcqSeatingRange, string> = {
  R_50_100: "50–100",
  R_100_150: "100–150",
  R_150_200: "150–200",
  R_200_300: "200–300",
  R_300_500: "300–500",
  R_500_PLUS: "500+",
};

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

export const ACQ_DEAL_MODEL = ["MANAGEMENT", "FRANCHISE", "REVENUE_MARGIN"] as const;
export type AcqDealModel = (typeof ACQ_DEAL_MODEL)[number];
export const ACQ_DEAL_MODEL_LABEL: Record<AcqDealModel, string> = {
  MANAGEMENT: "Management",
  FRANCHISE: "Franchise",
  REVENUE_MARGIN: "Revenue Margin",
};

/** How REVENUE_MARGIN prices are quoted. */
export const ACQ_RM_PRICE_BASIS = ["PER_EVENT", "PER_PAX"] as const;
export type AcqRmPriceBasis = (typeof ACQ_RM_PRICE_BASIS)[number];
export const ACQ_RM_PRICE_BASIS_LABEL: Record<AcqRmPriceBasis, string> = {
  PER_EVENT: "Per event",
  PER_PAX: "Per pax",
};

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
  // A Won deal at/above this projected fee value needs BD Head sign-off (P-2).
  LARGE_DEAL_SIGNOFF_VALUE: 1500000,
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
