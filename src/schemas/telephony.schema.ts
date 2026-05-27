import { z } from "zod";

const telephonyProviderValues = ["EXOTEL", "KNOWLARITY", "MYOPERATOR"] as const;

export const telephonyConfigSchema = z.object({
  id: z.string().optional(),
  provider: z.enum(telephonyProviderValues),
  apiKey: z.string().min(1, "API Key is required"),
  apiSecret: z.string().optional().or(z.literal("")),
  callerId: z.string().min(1, "Caller ID / Virtual Number is required"),
  accountSid: z.string().optional().or(z.literal("")),
  subdomain: z.string().optional().or(z.literal("")),
  webhookSecret: z.string().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export type TelephonyConfigInput = z.infer<typeof telephonyConfigSchema>;

export const initiateCallSchema = z.object({
  contactId: z.string().min(1, "Contact is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
});

export type InitiateCallInput = z.infer<typeof initiateCallSchema>;
