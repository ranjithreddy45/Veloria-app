import { z } from "zod";

// ============================================================
// WhatsApp Config Schema
// ------------------------------------------------------------
// Supports two providers behind one config row:
//   • META   — Meta WhatsApp Cloud API (needs phoneNumberId + businessAccountId)
//   • WEFLUX — weflux BSP (accessToken holds the wfx_live_ key; endpoint optional)
// ============================================================

export const whatsappConfigSchema = z
  .object({
    id: z.string().optional(), // Present when updating
    provider: z.enum(["META", "WEFLUX"]).default("META"),
    accessToken: z.string().min(1, "API key / access token is required"),
    phoneNumberId: z.string().optional().or(z.literal("")),
    businessAccountId: z.string().optional().or(z.literal("")),
    appSecret: z.string().optional().or(z.literal("")),
    apiEndpoint: z.string().optional().or(z.literal("")),
    verifyToken: z.string().min(1, "Verify / webhook token is required"),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
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
  });

export type WhatsAppConfigInput = z.infer<typeof whatsappConfigSchema>;
