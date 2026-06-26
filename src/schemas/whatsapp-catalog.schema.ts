// ============================================================
// WhatsApp Catalog — Zod schemas
// ============================================================
// Parsed before any DB write per convention. Non-action module (types +
// zod live OUTSIDE "use server" files).

import { z } from "zod";

// Stage values mirror WhatsAppCatalogSession.stage (string-valued machine).
export const CATALOG_STAGE_VALUES = [
  "PROMPTED",
  "EVENT_SELECTED",
  "CARDS_SENT",
  "CTA_CLICKED",
  "CLOSED",
] as const;

export const catalogSessionFilterSchema = z.object({
  stage: z.enum(CATALOG_STAGE_VALUES).optional(),
  eventType: z.string().trim().min(1).max(40).optional(),
  search: z.string().trim().max(60).optional(), // phone fragment
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type CatalogSessionFilter = z.infer<typeof catalogSessionFilterSchema>;

export const resendCatalogPromptSchema = z.object({
  // Accept any common phone format; the engine canonicalizes before lookup.
  phone: z
    .string()
    .trim()
    .min(6, "Enter a valid phone number")
    .max(20, "Phone number too long")
    .regex(/^[+\d][\d\s\-()]*$/, "Invalid phone number"),
});

export type ResendCatalogPromptInput = z.infer<typeof resendCatalogPromptSchema>;

// ------------------------------------------------------------
// Admin config — enable/disable + per-event-type label / brochure-slug / food
// tier maps. Persisted additively (single config row / env flag); see engine
// content for the canonical defaults this overrides.
// ------------------------------------------------------------
export const catalogEventConfigSchema = z.object({
  buttonId: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1, "Label required").max(40),
  brochureSlug: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9-]*$/i, "Slug may contain letters, numbers, hyphens")
    .optional()
    .or(z.literal("")),
  foodTierIds: z.array(z.string().trim().min(1).max(40)).max(6),
});

export const catalogConfigSchema = z.object({
  enabled: z.boolean().default(true),
  events: z.array(catalogEventConfigSchema).max(10),
});

export type CatalogEventConfigInput = z.infer<typeof catalogEventConfigSchema>;
export type CatalogConfigInput = z.infer<typeof catalogConfigSchema>;
