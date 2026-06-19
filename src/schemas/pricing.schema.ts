import { z } from "zod";

// ============================================================
// Pricing Rule Type Enum Values (matching Prisma PricingRuleType)
// ============================================================

const pricingRuleTypeValues = [
  "SEASONAL",
  "DAY_OF_WEEK",
  "PEAK_HOUR",
  "EARLY_BIRD",
  "LAST_MINUTE",
  "OCCUPANCY",
  "DEMAND",
  "LEAD_TIME",
] as const;

// ============================================================
// Pricing Rule Schema
// ============================================================

export const pricingRuleSchema = z.object({
  name: z
    .string()
    .min(1, "Rule name is required")
    .max(200, "Rule name must be at most 200 characters"),
  ruleType: z.enum(pricingRuleTypeValues, {
    error: "Rule type is required",
  }),
  multiplier: z
    .number({
      error: "Multiplier must be a number",
    })
    .positive("Multiplier must be positive")
    .max(10, "Multiplier must be at most 10"),
  conditions: z.any().optional(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  dayOfWeek: z
    .number()
    .int()
    .min(0, "Day of week must be between 0 (Sunday) and 6 (Saturday)")
    .max(6, "Day of week must be between 0 (Sunday) and 6 (Saturday)")
    .optional()
    .nullable(),
  minDaysAhead: z
    .number()
    .int()
    .min(0, "Minimum days ahead must be non-negative")
    .optional()
    .nullable(),
  isActive: z.boolean().default(true),
  priority: z
    .number({
      error: "Priority must be a number",
    })
    .int("Priority must be a whole number")
    .min(0, "Priority must be non-negative")
    .default(0),
  venueId: z.string().min(1, "Venue is required"),
});

export type PricingRuleInput = z.infer<typeof pricingRuleSchema>;

// ============================================================
// Rate Plan Schema
// ============================================================

export const ratePlanSchema = z.object({
  name: z
    .string()
    .min(1, "Plan name is required")
    .max(200, "Plan name must be at most 200 characters"),
  description: z
    .string()
    .max(2000, "Description must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
  baseRate: z
    .number({
      error: "Base rate must be a number",
    })
    .min(0, "Base rate must be non-negative"),
  perGuestRate: z
    .number({
      error: "Per-guest rate must be a number",
    })
    .min(0, "Per-guest rate must be non-negative"),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  venueId: z.string().optional().or(z.literal("")),
});

export type RatePlanInput = z.infer<typeof ratePlanSchema>;
