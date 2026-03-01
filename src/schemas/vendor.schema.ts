import { z } from "zod";

// ============================================================
// Vendor Category & Status Enum Values (matching Prisma enums)
// ============================================================

const vendorCategoryValues = [
  "CATERING",
  "DECORATION",
  "PHOTOGRAPHY",
  "VIDEOGRAPHY",
  "ENTERTAINMENT",
  "FLORIST",
  "TRANSPORTATION",
  "LIGHTING",
  "SOUND",
  "SECURITY",
  "CLEANING",
  "RENTAL",
  "OTHER",
] as const;

const vendorStatusValues = [
  "ACTIVE",
  "INACTIVE",
  "BLACKLISTED",
  "PENDING_APPROVAL",
] as const;

const vendorAssignmentStatusValues = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
] as const;

// ============================================================
// Vendor Create/Update Schema
// ============================================================

export const vendorSchema = z.object({
  name: z
    .string()
    .min(1, "Vendor name is required")
    .max(200, "Vendor name must be at most 200 characters"),
  category: z.enum(vendorCategoryValues, {
    error: "Category is required",
  }),
  status: z.enum(vendorStatusValues).optional().default("ACTIVE"),
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
  company: z
    .string()
    .max(200, "Company must be at most 200 characters")
    .optional()
    .or(z.literal("")),
  address: z
    .string()
    .max(500, "Address must be at most 500 characters")
    .optional()
    .or(z.literal("")),
  gstin: z
    .string()
    .max(15, "GSTIN must be at most 15 characters")
    .optional()
    .or(z.literal("")),
  website: z
    .string()
    .url("Invalid URL")
    .optional()
    .or(z.literal("")),
  tags: z.array(z.string()).optional().default([]),
});

export type VendorInput = z.infer<typeof vendorSchema>;

// ============================================================
// Booking Vendor Assignment Schema
// ============================================================

export const assignVendorSchema = z.object({
  role: z
    .string()
    .max(100, "Role must be at most 100 characters")
    .optional()
    .or(z.literal("")),
  agreedRate: z
    .number({ error: "Agreed rate must be a number" })
    .positive("Agreed rate must be positive")
    .optional(),
  notes: z
    .string()
    .max(2000, "Notes must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
});

export type AssignVendorInput = z.infer<typeof assignVendorSchema>;

// ============================================================
// Update Vendor Assignment Schema
// ============================================================

export const updateAssignmentSchema = z.object({
  status: z.enum(vendorAssignmentStatusValues).optional(),
  agreedRate: z
    .number({ error: "Agreed rate must be a number" })
    .positive("Agreed rate must be positive")
    .optional(),
  notes: z
    .string()
    .max(2000, "Notes must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
});

export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;

// ============================================================
// Vendor Bid Schema
// ============================================================

export const vendorBidSchema = z.object({
  amount: z
    .number({ error: "Bid amount must be a number" })
    .positive("Bid amount must be positive"),
  message: z
    .string()
    .max(2000, "Message must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
});

export type VendorBidInput = z.infer<typeof vendorBidSchema>;
