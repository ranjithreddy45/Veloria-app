import { z } from "zod";

// ============================================================
// Yield / Dynamic Pricing — Zod schemas
// ------------------------------------------------------------
// The three new yield rule types (OCCUPANCY / DEMAND / LEAD_TIME) reuse the
// existing PricingRule row; their thresholds are stored in the existing
// `PricingRule.conditions` Json column. These schemas validate that JSON shape
// in the config form BEFORE it is written via createPricingRule/updatePricingRule
// (the DB-layer pricingRuleSchema only types `conditions` as z.any()).
// ============================================================

export const yieldRuleTypeValues = [
  "OCCUPANCY",
  "DEMAND",
  "LEAD_TIME",
] as const;

export type YieldRuleType = (typeof yieldRuleTypeValues)[number];

// ------------------------------------------------------------
// Per-type conditions sub-schemas (stored in PricingRule.conditions Json).
// All bounds are optional in the engine (missing => fully open band), but the
// form validates the bounds the user did supply so they stay sane.
// ------------------------------------------------------------

export const occupancyConditionsSchema = z
  .object({
    minOccupancyPct: z.number().min(0).max(100).optional().nullable(),
    maxOccupancyPct: z.number().min(0).max(100).optional().nullable(),
  })
  .refine(
    (v) =>
      v.minOccupancyPct == null ||
      v.maxOccupancyPct == null ||
      v.minOccupancyPct <= v.maxOccupancyPct,
    { message: "Min occupancy must be ≤ max occupancy", path: ["maxOccupancyPct"] }
  );

export const demandConditionsSchema = z
  .object({
    minDemandScore: z.number().min(0).max(100).optional().nullable(),
    maxDemandScore: z.number().min(0).max(100).optional().nullable(),
  })
  .refine(
    (v) =>
      v.minDemandScore == null ||
      v.maxDemandScore == null ||
      v.minDemandScore <= v.maxDemandScore,
    { message: "Min demand must be ≤ max demand", path: ["maxDemandScore"] }
  );

export const leadTimeConditionsSchema = z
  .object({
    minLeadDays: z.number().int().min(0).optional().nullable(),
    maxLeadDays: z.number().int().min(0).optional().nullable(),
  })
  .refine(
    (v) =>
      v.minLeadDays == null ||
      v.maxLeadDays == null ||
      v.minLeadDays <= v.maxLeadDays,
    { message: "Min lead days must be ≤ max lead days", path: ["maxLeadDays"] }
  );

/**
 * Validate a conditions object for a given yield rule type. Returns the parsed
 * (and typed) conditions or throws via safeParse handling at the call site.
 */
export function yieldPricingRuleConditionsSchema(ruleType: YieldRuleType) {
  switch (ruleType) {
    case "OCCUPANCY":
      return occupancyConditionsSchema;
    case "DEMAND":
      return demandConditionsSchema;
    case "LEAD_TIME":
      return leadTimeConditionsSchema;
  }
}

export type OccupancyConditions = z.infer<typeof occupancyConditionsSchema>;
export type DemandConditions = z.infer<typeof demandConditionsSchema>;
export type LeadTimeConditions = z.infer<typeof leadTimeConditionsSchema>;

// ------------------------------------------------------------
// VenueDemandSignal upsert schema (manual override rows).
// ------------------------------------------------------------

export const demandSignalTimeSlotValues = [
  "MORNING",
  "AFTERNOON",
  "EVENING",
  "FULL_DAY",
] as const;

export const venueDemandSignalSchema = z.object({
  venueId: z.string().min(1, "Venue is required"),
  date: z.coerce.date({ error: "Date is required" }),
  timeSlot: z.enum(demandSignalTimeSlotValues).nullable().optional(),
  occupancyPct: z
    .number({ error: "Occupancy must be a number" })
    .min(0, "Occupancy must be ≥ 0")
    .max(100, "Occupancy must be ≤ 100"),
  demandScore: z
    .number({ error: "Demand score must be a number" })
    .min(0, "Demand score must be ≥ 0")
    .max(100, "Demand score must be ≤ 100"),
  inquiryCount: z
    .number()
    .int("Inquiry count must be a whole number")
    .min(0, "Inquiry count must be non-negative")
    .default(0),
  manualMultiplier: z
    .number()
    .positive("Multiplier must be positive")
    .max(10, "Multiplier must be at most 10")
    .optional()
    .nullable(),
});

export type VenueDemandSignalInput = z.infer<typeof venueDemandSignalSchema>;
