import { z } from "zod";

// ============================================================
// Insurance Type Values
// ============================================================

const insuranceTypeValues = [
  "EVENT_LIABILITY",
  "PROPERTY",
  "CANCELLATION",
  "WEATHER",
] as const;

// ============================================================
// Insurance Policy Create/Update Schema
// ============================================================

export const insurancePolicySchema = z.object({
  provider: z
    .string()
    .min(1, "Provider is required")
    .max(200, "Provider must be at most 200 characters"),
  policyNumber: z
    .string()
    .min(1, "Policy number is required")
    .max(100, "Policy number must be at most 100 characters"),
  type: z.enum(insuranceTypeValues, {
    error: "Insurance type is required",
  }),
  coverageAmount: z
    .number({ error: "Coverage amount must be a number" })
    .positive("Coverage amount must be positive"),
  premium: z
    .number({ error: "Premium must be a number" })
    .positive("Premium must be positive"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  bookingId: z.string().optional().or(z.literal("")),
  venueId: z.string().optional().or(z.literal("")),
  documents: z
    .array(
      z.object({
        name: z.string().min(1, "Document name is required"),
        url: z.string().url("Invalid document URL"),
      })
    )
    .optional(),
});

export type InsurancePolicyInput = z.infer<typeof insurancePolicySchema>;

export { insuranceTypeValues };
