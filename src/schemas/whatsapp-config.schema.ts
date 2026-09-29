import { z } from "zod";

// ============================================================
// WhatsApp Config Schema
// ------------------------------------------------------------
// Supports two providers behind one config row:
//   • META   — Meta WhatsApp Cloud API (needs phoneNumberId + businessAccountId)
//   • WEFLUX — weflux BSP (accessToken holds the wfx_live_ key; endpoint optional)
//   • AISENSY — AiSensy Custom App (Project ID + API password instead of a
//     single key, so accessToken is NOT required for this provider)
// ============================================================

export const whatsappConfigSchema = z
  .object({
    id: z.string().optional(), // Present when updating
    provider: z.enum(["META", "WEFLUX", "AISENSY"]).default("META"),
    // Required for META/WEFLUX only — enforced in superRefine, because AiSensy
    // authenticates with a Project ID + API password pair instead.
    accessToken: z.string().optional().or(z.literal("")),
    phoneNumberId: z.string().optional().or(z.literal("")),
    businessAccountId: z.string().optional().or(z.literal("")),
    appSecret: z.string().optional().or(z.literal("")),
    apiEndpoint: z.string().optional().or(z.literal("")),
    // Weflux CRM sync (all optional — only used when provider = WEFLUX).
    crmWebhookUrl: z.string().optional().or(z.literal("")),
    crmWebhookSecret: z.string().optional().or(z.literal("")),
    eventSigningSecret: z.string().optional().or(z.literal("")),
    verifyToken: z.string().min(1, "Verify / webhook token is required"),
    // AiSensy Custom App (all only used when provider = AISENSY).
    aisensyProjectId: z.string().optional().or(z.literal("")),
    aisensyApiPassword: z.string().optional().or(z.literal("")),
    aisensyApiEndpoint: z.string().optional().or(z.literal("")),
    aisensyWebhookSecret: z.string().optional().or(z.literal("")),
    aisensyVerifyToken: z.string().optional().or(z.literal("")),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.provider !== "AISENSY" && !data.accessToken) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["accessToken"],
        message: "API key / access token is required",
      });
    }
    if (data.provider === "META") {
      if (!data.phoneNumberId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["phoneNumberId"],
          message: "Phone Number ID is required for Meta Cloud API",
        });
      }
      if (!data.businessAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["businessAccountId"],
          message: "Business Account ID is required for Meta Cloud API",
        });
      }
    }
    // WEFLUX needs only the API key (accessToken); the endpoint defaults to
    // https://api.weflux.in/v2, so no extra required fields.
    if (data.provider === "AISENSY") {
      if (!data.aisensyProjectId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["aisensyProjectId"],
          message: "AiSensy Project ID is required",
        });
      }
      if (!data.aisensyApiPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["aisensyApiPassword"],
          message: "AiSensy API password is required",
        });
      }
      // The webhook secret and URL token are only needed to RECEIVE messages;
      // sending works without them, so they stay optional and the settings page
      // says so instead of blocking a send-only setup.
    }
  });

export type WhatsAppConfigInput = z.infer<typeof whatsappConfigSchema>;
