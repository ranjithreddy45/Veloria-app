import { z } from "zod";

import { isAllowedEmbedUrl, SLUG_REGEX } from "@/lib/marketing/brochure-embed";

// ============================================================
// Digital brochure — zod schemas (validation only, no IO).
// Shared by brochure.actions.ts (internal CRUD) for create/update.
// All money is a Decimal-safe STRING here; the action stores it as a
// Prisma.Decimal and serializes to a number only at the public DTO boundary.
// ============================================================

const CTA_VALUES = ["HOLD_DATE", "BOOK_VISIT", "GET_QUOTE", "WHATSAPP"] as const;
export const brochureCtaEnum = z.enum(CTA_VALUES);
export type BrochureCta = (typeof CTA_VALUES)[number];

/** Optional https URL whose host must be embed-allowlisted (or empty). */
const embedUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => v === "" || isAllowedEmbedUrl(v), {
    message: "Only YouTube, Vimeo or Matterport links are allowed.",
  })
  .optional()
  .or(z.literal(""));

/** Optional plain https image URL (hero) — no host allowlist, just shape. */
const httpsUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => v === "" || /^https:\/\/.+/i.test(v), {
    message: "Must be an https URL.",
  })
  .optional()
  .or(z.literal(""));

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Slug is required.")
  .max(80, "Slug is too long.")
  .regex(SLUG_REGEX, "Use lowercase letters, numbers and hyphens only.");

const idArray = z.array(z.string().min(1)).max(60).optional().default([]);

// Decimal-safe money: accept a non-negative numeric string (or empty → null).
const moneyString = z
  .string()
  .trim()
  .max(20)
  .refine((v) => v === "" || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) >= 0), {
    message: "Enter a valid amount.",
  })
  .optional()
  .or(z.literal(""));

const whatsappNumber = z
  .string()
  .trim()
  .max(20)
  .refine((v) => v === "" || /^\+?\d{7,15}$/.test(v.replace(/[\s-]/g, "")), {
    message: "Enter a valid phone number.",
  })
  .optional()
  .or(z.literal(""));

export const brochureCreateSchema = z.object({
  slug: slug.optional(), // auto-slugified from title when omitted
  venueId: z.string().min(1).optional().nullable(),
  eventType: z.string().trim().max(80).optional().nullable(),
  title: z.string().trim().min(1, "Title is required.").max(120),
  subtitle: z.string().trim().max(200).optional().nullable(),
  seoDescription: z.string().trim().max(320).optional().nullable(),
  heroImageUrl: httpsUrl,
  videoEmbedUrl: embedUrl,
  tour360Url: embedUrl,
  galleryItemIds: idArray,
  reviewIds: idArray,
  startingFromAmount: moneyString,
  currency: z.string().trim().length(3).optional().default("INR"),
  enabledCtas: z.array(brochureCtaEnum).max(4).optional().default([]),
  whatsappNumber,
});

export const brochureUpdateSchema = brochureCreateSchema.extend({
  id: z.string().min(1),
  slug, // required (already-minted) on update
});

export type BrochureCreateInput = z.input<typeof brochureCreateSchema>;
export type BrochureUpdateInput = z.input<typeof brochureUpdateSchema>;
