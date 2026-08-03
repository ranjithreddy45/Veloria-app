import { z } from "zod";

// ============================================================
// WhatsApp Config Schema
// ------------------------------------------------------------
// Supports two providers behind one config row:
//   • META — Meta WhatsApp Cloud API (needs phoneNumberId + businessAccountId)
//   • WATI — wati.io (needs apiEndpoint; accessToken holds the WATI token)
// ============================================================

export const whatsappConfigSchema = z
  .object({
    id: z.string().optional(), // Present when updating
    provider: z.enum(["META", "WATI"]).default("META"),
    accessToken: z.string().min(1, "Access Token is required"),
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
    } else if (data.provider === "WATI") {
      if (!data.apiEndpoint) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["apiEndpoint"],
          message: "WATI API endpoint is required (e.g. https://live-mt-server.wati.io/<tenantId>)",
        });
      }
    }
  });

export type WhatsAppConfigInput = z.infer<typeof whatsappConfigSchema>;
