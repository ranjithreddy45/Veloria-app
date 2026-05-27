import { z } from "zod";

// ============================================================
// WhatsApp Config Schema
// ============================================================

export const whatsappConfigSchema = z.object({
  id: z.string().optional(), // Present when updating
  accessToken: z.string().min(1, "Access Token is required"),
  phoneNumberId: z.string().min(1, "Phone Number ID is required"),
  businessAccountId: z.string().min(1, "Business Account ID is required"),
  appSecret: z.string().optional().or(z.literal("")),
  verifyToken: z.string().min(1, "Verify Token is required"),
  isActive: z.boolean().default(true),
});

export type WhatsAppConfigInput = z.infer<typeof whatsappConfigSchema>;
