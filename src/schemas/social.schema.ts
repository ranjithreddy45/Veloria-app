import { z } from "zod";

// ============================================================
// Social Post Schemas
// ============================================================

const PLATFORMS = ["INSTAGRAM", "FACEBOOK", "TWITTER", "LINKEDIN"] as const;

export const socialPostSchema = z.object({
  platform: z.enum(PLATFORMS, {
    error: "Platform is required",
  }),
  content: z
    .string()
    .min(1, "Post content is required")
    .max(2200, "Post content must be at most 2200 characters"),
  imageUrl: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
  scheduledAt: z
    .string()
    .optional()
    .nullable(),
});

export type SocialPostInput = z.infer<typeof socialPostSchema>;

export const updateSocialPostSchema = z.object({
  platform: z.enum(PLATFORMS, {
    error: "Platform is required",
  }).optional(),
  content: z
    .string()
    .min(1, "Post content is required")
    .max(2200, "Post content must be at most 2200 characters")
    .optional(),
  imageUrl: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
  scheduledAt: z
    .string()
    .optional()
    .nullable(),
});

export type UpdateSocialPostInput = z.infer<typeof updateSocialPostSchema>;

export const scheduleSocialPostSchema = z.object({
  scheduledAt: z
    .string()
    .min(1, "Scheduled date/time is required"),
});

export type ScheduleSocialPostInput = z.infer<typeof scheduleSocialPostSchema>;
