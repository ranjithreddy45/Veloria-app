import { z } from "zod";

// ============================================================
// Document Categories
// ============================================================

export const DOCUMENT_CATEGORIES = [
  "CONTRACT",
  "INVOICE",
  "PROPOSAL",
  "PHOTO",
  "VIDEO",
  "FLOOR_PLAN",
  "MENU",
  "LICENSE",
  "INSURANCE",
  "OTHER",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

// ============================================================
// Document Schema
// ============================================================

export const documentSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be at most 200 characters"),
  category: z.enum(DOCUMENT_CATEGORIES, {
    error: "Please select a valid category",
  }),
  fileName: z
    .string()
    .max(500, "File name must be at most 500 characters")
    .optional()
    .or(z.literal("")),
  mimeType: z
    .string()
    .max(100, "MIME type must be at most 100 characters")
    .optional()
    .or(z.literal("")),
  size: z.coerce.number().int().nonnegative().optional().default(0),
  url: z
    .string()
    .max(2000, "URL must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
  bookingId: z.string().optional().or(z.literal("")),
  contactId: z.string().optional().or(z.literal("")),
  venueId: z.string().optional().or(z.literal("")),
  isPublic: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

export type DocumentInput = z.infer<typeof documentSchema>;

// ============================================================
// Document Update Schema
// ============================================================

export const documentUpdateSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be at most 200 characters")
    .optional(),
  category: z
    .enum(DOCUMENT_CATEGORIES, {
      error: "Please select a valid category",
    })
    .optional(),
  isPublic: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export type DocumentUpdateInput = z.infer<typeof documentUpdateSchema>;
