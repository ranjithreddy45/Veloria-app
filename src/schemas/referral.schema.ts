import { z } from "zod";

// ============================================================
// Referral Status Values (matching Prisma ReferralStatus)
// ============================================================

export const referralStatusValues = [
  "PENDING",
  "CONTACTED",
  "CONVERTED",
  "EXPIRED",
] as const;

// ============================================================
// Create Referral Schema
// ============================================================

export const createReferralSchema = z.object({
  referrerContactId: z.string().min(1, "Referrer contact is required"),
  referredName: z
    .string()
    .min(1, "Referred person name is required")
    .max(200, "Name must be at most 200 characters"),
  referredEmail: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  referredPhone: z
    .string()
    .max(20, "Phone must be at most 20 characters")
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .max(5000, "Notes must be at most 5000 characters")
    .optional()
    .or(z.literal("")),
});

export type CreateReferralInput = z.infer<typeof createReferralSchema>;

// ============================================================
// Update Referral Schema
// ============================================================

export const updateReferralSchema = z.object({
  referredName: z
    .string()
    .min(1, "Referred person name is required")
    .max(200, "Name must be at most 200 characters")
    .optional(),
  referredEmail: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  referredPhone: z
    .string()
    .max(20, "Phone must be at most 20 characters")
    .optional()
    .or(z.literal("")),
  status: z.enum(referralStatusValues).optional(),
  notes: z
    .string()
    .max(5000, "Notes must be at most 5000 characters")
    .optional()
    .or(z.literal("")),
});

export type UpdateReferralInput = z.infer<typeof updateReferralSchema>;
