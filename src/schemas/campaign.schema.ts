import { z } from "zod";

// ============================================================
// Campaign Schemas
// ============================================================

export const campaignSchema = z.object({
  name: z
    .string()
    .min(1, "Campaign name is required")
    .max(200, "Campaign name must be at most 200 characters"),
  subject: z
    .string()
    .min(1, "Subject line is required")
    .max(500, "Subject must be at most 500 characters"),
  htmlContent: z
    .string()
    .min(1, "Email content is required"),
  recipientFilter: z
    .object({
      eventType: z.string().optional(),
      contactType: z.string().optional(),
    })
    .optional()
    .nullable(),
  scheduledAt: z
    .string()
    .optional()
    .nullable(),
});

export type CampaignInput = z.infer<typeof campaignSchema>;

export const scheduleCampaignSchema = z.object({
  scheduledAt: z
    .string()
    .min(1, "Scheduled date/time is required"),
});

export type ScheduleCampaignInput = z.infer<typeof scheduleCampaignSchema>;

// ============================================================
// Email Template Schemas
// ============================================================

export const emailTemplateSchema = z.object({
  name: z
    .string()
    .min(1, "Template name is required")
    .max(200, "Template name must be at most 200 characters"),
  subject: z
    .string()
    .min(1, "Subject line is required")
    .max(500, "Subject must be at most 500 characters"),
  htmlContent: z
    .string()
    .min(1, "Template content is required"),
  category: z
    .string()
    .optional()
    .or(z.literal("")),
  isActive: z
    .boolean()
    .default(true),
});

export type EmailTemplateInput = z.infer<typeof emailTemplateSchema>;
