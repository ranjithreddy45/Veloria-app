import { z } from "zod";

// ============================================================
// Media Type Values (matching Prisma defaults)
// ============================================================

const mediaTypeValues = ["PHOTO", "VIDEO"] as const;

// ============================================================
// Gallery Item Create/Update Schema
// ============================================================

export const galleryItemSchema = z.object({
  title: z
    .string()
    .max(200, "Title must be at most 200 characters")
    .optional()
    .or(z.literal("")),
  description: z
    .string()
    .max(2000, "Description must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
  mediaType: z.enum(mediaTypeValues, {
    error: "Media type is required",
  }).optional().default("PHOTO"),
  url: z
    .string()
    .url("A valid URL is required")
    .min(1, "URL is required"),
  thumbnailUrl: z
    .string()
    .url("Invalid thumbnail URL")
    .optional()
    .or(z.literal("")),
  tags: z.array(z.string()).optional().default([]),
  isPublic: z.boolean().optional().default(false),
  order: z.number().int().optional().default(0),
  bookingId: z.string().optional().or(z.literal("")),
  venueId: z.string().optional().or(z.literal("")),
  // Event-day capture bucket (optional — the action defaults to GENERAL). Kept
  // WITHOUT .default() so `kind` stays optional in the input type, otherwise every
  // existing createGalleryItem caller would be forced to pass it.
  kind: z.enum(["GENERAL", "PRE_READINESS", "POST_READINESS", "DURING_EVENT"]).optional(),
});

export type GalleryItemInput = z.infer<typeof galleryItemSchema>;

// ============================================================
// Gallery Item Update Schema (partial)
// ============================================================

export const updateGalleryItemSchema = z.object({
  title: z
    .string()
    .max(200, "Title must be at most 200 characters")
    .optional()
    .or(z.literal("")),
  description: z
    .string()
    .max(2000, "Description must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
  mediaType: z.enum(mediaTypeValues).optional(),
  url: z
    .string()
    .url("A valid URL is required")
    .optional(),
  thumbnailUrl: z
    .string()
    .url("Invalid thumbnail URL")
    .optional()
    .or(z.literal("")),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  order: z.number().int().optional(),
  bookingId: z.string().optional().or(z.literal("")),
  venueId: z.string().optional().or(z.literal("")),
});

export type UpdateGalleryItemInput = z.infer<typeof updateGalleryItemSchema>;
