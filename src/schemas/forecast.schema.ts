import { z } from "zod";
import { BUDGET_CATEGORIES } from "@/lib/constants";

// ============================================================
// Budget Schema
// ============================================================

export const budgetSchema = z.object({
  name: z
    .string()
    .min(1, "Budget name is required")
    .max(200, "Name must be at most 200 characters"),
  venueId: z
    .string()
    .optional()
    .or(z.literal("")),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),
  year: z
    .number({ error: "Year must be a number" })
    .int("Year must be a whole number")
    .min(2020, "Year must be 2020 or later")
    .max(2099, "Year must be 2099 or earlier"),
  revenue: z
    .number({ error: "Revenue must be a number" })
    .min(0, "Revenue cannot be negative"),
  expenses: z
    .number({ error: "Expenses must be a number" })
    .min(0, "Expenses cannot be negative"),
  profit: z
    .number({ error: "Profit must be a number" }),
  category: z
    .enum(BUDGET_CATEGORIES as unknown as [string, ...string[]], {
      error: "Invalid category",
    })
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .max(2000, "Notes must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
});

export type BudgetInput = z.infer<typeof budgetSchema>;

// ============================================================
// Generate Forecast Schema
// ============================================================

export const generateForecastSchema = z.object({
  months: z
    .number({ error: "Months must be a number" })
    .int("Months must be a whole number")
    .min(1, "Minimum 1 month")
    .max(12, "Maximum 12 months"),
});

export type GenerateForecastInput = z.infer<typeof generateForecastSchema>;
