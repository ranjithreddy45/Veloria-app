import { z } from "zod";

// ============================================================
// Attribution Schemas
// ------------------------------------------------------------
// Mirrors campaign.schema.ts conventions. The attribution input is
// captured from PUBLIC, untrusted request surfaces (webforms, ad-network
// webhooks, the universal capture API, storefront enquiry), so every
// field is optional, trimmed, and length-capped to keep abusive payloads
// from bloating the DB. Capture is best-effort — validation never blocks
// lead creation; bad fields are simply dropped.
// ============================================================

// Cap raw label-ish fields. URLs get a longer cap.
const optLabel = z
  .string()
  .trim()
  .max(255, "Value too long")
  .optional();

const optUrl = z
  .string()
  .trim()
  .max(2048, "URL too long")
  .optional();

export const attributionInputSchema = z.object({
  source: optLabel,
  medium: optLabel,
  campaign: optLabel,
  term: optLabel,
  content: optLabel,
  utmSource: optLabel,
  utmMedium: optLabel,
  utmCampaign: optLabel,
  referrerUrl: optUrl,
  landingUrl: optUrl,
  gclid: optLabel,
  fbclid: optLabel,
  clientId: optLabel,
});

export type AttributionInput = z.infer<typeof attributionInputSchema>;

// ============================================================
// Marketing Campaign Schemas
// ============================================================

export const marketingCampaignSchema = z.object({
  name: z
    .string()
    .min(1, "Campaign name is required")
    .max(200, "Campaign name must be at most 200 characters"),
  channel: z
    .string()
    .min(1, "Channel is required")
    .max(100, "Channel must be at most 100 characters"),
  utmSource: z.string().max(255).optional().or(z.literal("")),
  utmMedium: z.string().max(255).optional().or(z.literal("")),
  utmCampaign: z.string().max(255).optional().or(z.literal("")),
  spendToDate: z.coerce
    .number({ message: "Spend must be a number" })
    .min(0, "Spend cannot be negative")
    .default(0),
  currency: z.string().min(1).max(8).default("INR"),
  startDate: z.string().optional().or(z.literal("")).nullable(),
  endDate: z.string().optional().or(z.literal("")).nullable(),
  isActive: z.boolean().default(true),
  notes: z.string().max(5000).optional().or(z.literal("")),
});

export type MarketingCampaignInput = z.infer<typeof marketingCampaignSchema>;

// Spend-only quick update (inline "link spend" affordance on the table).
export const campaignSpendSchema = z.object({
  spendToDate: z.coerce
    .number({ message: "Spend must be a number" })
    .min(0, "Spend cannot be negative"),
});

export type CampaignSpendInput = z.infer<typeof campaignSpendSchema>;

// ============================================================
// Attribution Analytics types (shared by the action + the cockpit UI).
// Kept here (NOT in the "use server" file, which may export only async fns).
// ============================================================

export interface AttributionBucket {
  key: string; // channel label or campaign id
  label: string; // display name
  leadCount: number;
  wonCount: number;
  winRate: number; // 0..1
  bookedRevenue: number;
  spend: number;
  cac: number | null;
  roas: number | null;
  avgLtv: number | null;
}

export interface AttributionRangeParams {
  from?: string;
  to?: string;
}
