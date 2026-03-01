import { z } from "zod";

// ============================================================
// Tasting Status Values (matching Prisma TastingStatus)
// ============================================================

const tastingStatusValues = [
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

// ============================================================
// Selected Menu Item Schema (for Json field)
// ============================================================

const selectedItemSchema = z.object({
  name: z.string().min(1, { error: "Item name is required" }),
  category: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

// ============================================================
// Create Tasting Schema
// ============================================================

export const createTastingSchema = z.object({
  scheduledDate: z
    .string()
    .min(1, { error: "Scheduled date is required" }),
  scheduledTime: z
    .string()
    .min(1, { error: "Scheduled time is required" })
    .max(20, { error: "Time must be at most 20 characters" }),
  contactId: z.string().min(1, { error: "Contact is required" }),
  venueId: z.string().optional().or(z.literal("")),
  notes: z
    .string()
    .max(5000, { error: "Notes must be at most 5000 characters" })
    .optional()
    .or(z.literal("")),
  selectedItems: z.array(selectedItemSchema).optional().default([]),
});

export type CreateTastingInput = z.infer<typeof createTastingSchema>;

// ============================================================
// Update Tasting Schema
// ============================================================

export const updateTastingSchema = z.object({
  scheduledDate: z
    .string()
    .min(1, { error: "Scheduled date is required" })
    .optional(),
  scheduledTime: z
    .string()
    .min(1, { error: "Scheduled time is required" })
    .max(20, { error: "Time must be at most 20 characters" })
    .optional(),
  venueId: z.string().optional().or(z.literal("")),
  notes: z
    .string()
    .max(5000, { error: "Notes must be at most 5000 characters" })
    .optional()
    .or(z.literal("")),
  selectedItems: z.array(selectedItemSchema).optional(),
});

export type UpdateTastingInput = z.infer<typeof updateTastingSchema>;

// ============================================================
// Complete Tasting Schema (with feedback)
// ============================================================

export const completeTastingSchema = z.object({
  feedback: z
    .string()
    .max(10000, { error: "Feedback must be at most 10000 characters" })
    .optional()
    .or(z.literal("")),
});

export type CompleteTastingInput = z.infer<typeof completeTastingSchema>;

// ============================================================
// Cancel Tasting Schema
// ============================================================

export const cancelTastingSchema = z.object({
  reason: z
    .string()
    .max(2000, { error: "Reason must be at most 2000 characters" })
    .optional()
    .or(z.literal("")),
});

export type CancelTastingInput = z.infer<typeof cancelTastingSchema>;

// ============================================================
// Tasting Status Schema
// ============================================================

export const tastingStatusSchema = z.object({
  status: z.enum(tastingStatusValues, {
    error: "Invalid tasting status",
  }),
});

export type TastingStatusInput = z.infer<typeof tastingStatusSchema>;
