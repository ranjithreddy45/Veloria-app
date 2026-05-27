import { z } from "zod";

// ============================================================
// Generic Lead Capture Schema
// ============================================================

export const leadCaptureSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  source: z.string().min(1, "Source is required"),
  message: z.string().max(5000).optional().or(z.literal("")),
  eventType: z.string().optional().or(z.literal("")),
  eventDate: z.string().optional().or(z.literal("")),
  guestCount: z.coerce.number().int().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export type LeadCaptureInput = z.infer<typeof leadCaptureSchema>;

// ============================================================
// Facebook Lead Schema
// ============================================================

export const facebookLeadWebhookSchema = z.object({
  object: z.literal("page"),
  entry: z.array(
    z.object({
      id: z.string(),
      time: z.number(),
      changes: z.array(
        z.object({
          value: z.object({
            form_id: z.string(),
            leadgen_id: z.string(),
            created_time: z.number(),
            page_id: z.string(),
          }),
          field: z.literal("leadgen"),
        })
      ),
    })
  ),
});

export type FacebookLeadWebhookInput = z.infer<typeof facebookLeadWebhookSchema>;

// ============================================================
// Google Ads Lead Schema
// ============================================================

export const googleAdsLeadSchema = z.object({
  lead_id: z.string(),
  campaign_id: z.string().optional(),
  form_id: z.string().optional(),
  user_column_data: z.array(
    z.object({
      column_id: z.string(),
      string_value: z.string().optional(),
    })
  ).optional(),
  gcl_id: z.string().optional(),
});

export type GoogleAdsLeadInput = z.infer<typeof googleAdsLeadSchema>;
