import { z } from "zod";

// ============================================================
// Media Type Values (matching Prisma defaults)
// ============================================================

const mediaTypeValues = ["PHOTO", "VIDEO"] as const;

// ============================================================
// Media URLs
// ------------------------------------------------------------
// Public gallery photos are served from the app's own origin
// (/api/guest/photo/g/<id>), which serves only PNG, JPEG, GIF and WebP data
// URLs. So an uploaded file may only be a base64 data URL of one of those four
// types, and anything else must be an http(s) link. z.string().url() alone let
// "data:text/html,…" and "javascript:…" through.
// ============================================================

const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/i;

export const GALLERY_MEDIA_URL_MESSAGE = "Use an http(s) link, or upload a PNG, JPEG, GIF or WebP image";

/** An http(s) link, or a base64 data URL of a PNG, JPEG, GIF or WebP image. */
export function isAllowedGalleryMediaUrl(value: string): boolean {
  if (/^data:/i.test(value)) return IMAGE_DATA_URL.test(value);
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

const mediaUrl = () => z.string().refine(isAllowedGalleryMediaUrl, GALLERY_MEDIA_URL_MESSAGE);

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
    .min(1, "URL is required")
    .refine(isAllowedGalleryMediaUrl, GALLERY_MEDIA_URL_MESSAGE),
  thumbnailUrl: mediaUrl()
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
  url: mediaUrl().optional(),
  thumbnailUrl: mediaUrl()
    .optional()
    .or(z.literal("")),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  order: z.number().int().optional(),
  bookingId: z.string().optional().or(z.literal("")),
  venueId: z.string().optional().or(z.literal("")),
});

export type UpdateGalleryItemInput = z.infer<typeof updateGalleryItemSchema>;
