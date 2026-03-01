import { z } from "zod";

// ============================================================
// Earn Points Schema
// ============================================================

export const earnPointsSchema = z.object({
  accountId: z.string().optional(),
  contactId: z.string().optional(),
  points: z
    .number()
    .int("Points must be a whole number")
    .positive("Points must be a positive number"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(500, "Description must be at most 500 characters"),
  referenceId: z.string().optional(),
}).refine((data) => data.accountId || data.contactId, {
  message: "Either accountId or contactId is required",
  path: ["accountId"],
});

export type EarnPointsInput = z.infer<typeof earnPointsSchema>;

// ============================================================
// Redeem Points Schema
// ============================================================

export const redeemPointsSchema = z.object({
  accountId: z.string().optional(),
  contactId: z.string().optional(),
  points: z
    .number()
    .int("Points must be a whole number")
    .positive("Points must be a positive number"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(500, "Description must be at most 500 characters"),
}).refine((data) => data.accountId || data.contactId, {
  message: "Either accountId or contactId is required",
  path: ["accountId"],
});

export type RedeemPointsInput = z.infer<typeof redeemPointsSchema>;

// ============================================================
// Adjust Points Schema (Admin)
// ============================================================

export const adjustPointsSchema = z.object({
  accountId: z.string().min(1, "Account ID is required"),
  points: z
    .number()
    .int("Points must be a whole number")
    .refine((val) => val !== 0, { message: "Points cannot be zero" }),
  description: z
    .string()
    .min(1, "Description is required")
    .max(500, "Description must be at most 500 characters"),
});

export type AdjustPointsInput = z.infer<typeof adjustPointsSchema>;
