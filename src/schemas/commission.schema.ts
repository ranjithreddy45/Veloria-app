import { z } from "zod";

// ============================================================
// Commission Rule Schema
// ============================================================

export const commissionRuleSchema = z.object({
  name: z
    .string()
    .min(1, "Rule name is required")
    .max(200, "Name must be at most 200 characters"),
  role: z
    .string()
    .max(50, "Role must be at most 50 characters")
    .optional()
    .or(z.literal("")),
  userId: z
    .string()
    .optional()
    .or(z.literal("")),
  bookingType: z
    .string()
    .max(100, "Booking type must be at most 100 characters")
    .optional()
    .or(z.literal("")),
  percentage: z
    .number({
      error: "Percentage must be a number",
    })
    .positive("Percentage must be positive")
    .max(100, "Percentage cannot exceed 100"),
  flatAmount: z
    .number({
      error: "Flat amount must be a number",
    })
    .positive("Flat amount must be positive")
    .optional()
    .nullable(),
  isActive: z.boolean({
    error: "Active status is required",
  }),
});

export type CommissionRuleInput = z.infer<typeof commissionRuleSchema>;

// ============================================================
// Calculate Commission Schema
// ============================================================

export const calculateCommissionSchema = z.object({
  ruleId: z.string().min(1, "Commission rule is required"),
  userId: z.string().min(1, "User is required"),
  bookingId: z.string().min(1, "Booking is required"),
  invoiceAmount: z
    .number({
      error: "Invoice amount must be a number",
    })
    .positive("Invoice amount must be positive"),
});

export type CalculateCommissionInput = z.infer<typeof calculateCommissionSchema>;
