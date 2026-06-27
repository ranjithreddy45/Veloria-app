import { z } from "zod";

// ============================================================
// Peak-date + demand-config validation
// ------------------------------------------------------------
// Inputs for the Date-Demand Pricing admin UI. Dates arrive as "YYYY-MM-DD"
// strings (the calendar day) and are parsed to UTC-midnight in the action so
// they match the @db.Date column (read back as UTC midnight) everywhere else.
// ============================================================

export const PEAK_DATE_TYPES = ["MUHURTHAM", "FESTIVAL", "CUSTOM"] as const;
export type PeakDateType = (typeof PEAK_DATE_TYPES)[number];

const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

const premiumPct = z
  .number()
  .int("Premium must be a whole number")
  .min(0, "Premium can't be negative")
  .max(200, "Premium can't exceed 200%");

export const peakDateSchema = z.object({
  date: dateKey,
  type: z.enum(PEAK_DATE_TYPES, { error: "Type is required" }),
  label: z
    .string()
    .trim()
    .min(1, "Label is required")
    .max(120, "Label is too long"),
  // null / undefined → use the DemandPricingConfig default for the type.
  premiumPct: premiumPct.nullish(),
  // null / "" → applies to all venues.
  venueId: z.string().trim().min(1).nullish(),
  isActive: z.boolean().default(true),
  note: z.string().trim().max(2000).nullish(),
});
export type PeakDateInput = z.infer<typeof peakDateSchema>;

// Edit form: every field optional (partial update).
export const peakDateUpdateSchema = peakDateSchema.partial();
export type PeakDateUpdateInput = z.infer<typeof peakDateUpdateSchema>;

// Bulk paste: one row per line "YYYY-MM-DD" or "YYYY-MM-DD, Label".
export const bulkPeakDateSchema = z.object({
  type: z.enum(PEAK_DATE_TYPES, { error: "Type is required" }),
  premiumPct: premiumPct.nullish(),
  venueId: z.string().trim().min(1).nullish(),
  rows: z
    .array(
      z.object({
        date: dateKey,
        label: z.string().trim().max(120).optional(),
      })
    )
    .min(1, "Add at least one date")
    .max(400, "Too many dates at once (max 400)"),
});
export type BulkPeakDateInput = z.infer<typeof bulkPeakDateSchema>;

export const demandConfigSchema = z.object({
  enabled: z.boolean(),
  muhurthamPct: premiumPct,
  festivalPct: premiumPct,
  saturdayPct: premiumPct,
  sundayPct: premiumPct,
  scarcityStepPct: premiumPct,
  scarcityCapPct: premiumPct,
});
export type DemandConfigInput = z.infer<typeof demandConfigSchema>;
