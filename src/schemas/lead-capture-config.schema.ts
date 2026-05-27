import { z } from "zod";

const leadCapturePlatformValues = ["FACEBOOK", "GOOGLE", "INDIAMART", "JUSTDIAL", "GENERIC"] as const;

export const leadCaptureConfigSchema = z.object({
  platform: z.enum(leadCapturePlatformValues),
  credentials: z.object({
    accessToken: z.string().optional().or(z.literal("")),
    appSecret: z.string().optional().or(z.literal("")),
    verifyToken: z.string().optional().or(z.literal("")),
    webhookToken: z.string().optional().or(z.literal("")),
    appId: z.string().optional().or(z.literal("")),
    pageId: z.string().optional().or(z.literal("")),
  }),
  isActive: z.boolean().default(true),
});

export type LeadCaptureConfigInput = z.infer<typeof leadCaptureConfigSchema>;
