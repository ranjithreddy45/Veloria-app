import { z } from "zod";

// ============================================================
// Guest Category & RSVP Status Enum Values (matching Prisma enums)
// ============================================================

const guestCategoryValues = [
  "VIP",
  "FAMILY",
  "FRIEND",
  "CORPORATE",
  "OTHER",
] as const;

const rsvpStatusValues = [
  "PENDING",
  "ACCEPTED",
  "DECLINED",
] as const;

// ============================================================
// Add / Update Guest Schema
// ============================================================

export const guestSchema = z.object({
  name: z
    .string()
    .min(1, "Guest name is required")
    .max(200, "Guest name must be at most 200 characters"),
  email: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .max(20, "Phone must be at most 20 characters")
    .optional()
    .or(z.literal("")),
  category: z.enum(guestCategoryValues, {
    error: "Category is required",
  }),
  tableAssignment: z
    .string()
    .max(100, "Table assignment must be at most 100 characters")
    .optional()
    .or(z.literal("")),
  plusOnes: z
    .number({ error: "Plus ones must be a number" })
    .int("Plus ones must be a whole number")
    .min(0, "Plus ones cannot be negative")
    .max(20, "Plus ones must be at most 20")
    .optional()
    .default(0),
  dietaryRestrictions: z
    .string()
    .max(500, "Dietary restrictions must be at most 500 characters")
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .max(2000, "Notes must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
});

export type GuestInput = z.infer<typeof guestSchema>;

// ============================================================
// Update RSVP Schema
// ============================================================

export const updateRSVPSchema = z.object({
  rsvpStatus: z.enum(rsvpStatusValues, {
    error: "RSVP status is required",
  }),
});

export type UpdateRSVPInput = z.infer<typeof updateRSVPSchema>;

// ============================================================
// Bulk Import Guest Schema (single guest row)
// ============================================================

export const bulkGuestRowSchema = z.object({
  name: z
    .string()
    .min(1, "Guest name is required")
    .max(200, "Guest name must be at most 200 characters"),
  email: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .max(20, "Phone must be at most 20 characters")
    .optional()
    .or(z.literal("")),
  category: z.enum(guestCategoryValues).optional().default("OTHER"),
  tableAssignment: z
    .string()
    .max(100, "Table assignment must be at most 100 characters")
    .optional()
    .or(z.literal("")),
  plusOnes: z
    .number()
    .int()
    .min(0)
    .max(20)
    .optional()
    .default(0),
});

export type BulkGuestRowInput = z.infer<typeof bulkGuestRowSchema>;

// ============================================================
// Bulk Import Schema (array of guests)
// ============================================================

export const bulkImportSchema = z.object({
  guests: z
    .array(bulkGuestRowSchema)
    .min(1, "At least one guest is required")
    .max(500, "Cannot import more than 500 guests at once"),
});

export type BulkImportInput = z.infer<typeof bulkImportSchema>;
