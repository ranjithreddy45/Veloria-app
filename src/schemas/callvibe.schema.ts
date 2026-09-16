import { z } from "zod";

// ============================================================
// CallVibe config schema.
// ------------------------------------------------------------
// CallVibe issues no static API key: every call is authorised with a bearer
// token obtained from POST /auth/signin, so the integration stores an account
// email and password. Use a dedicated CallVibe user for it, not a person's own
// login — the credentials outlive any one employee.
// ============================================================

export const callVibeConfigSchema = z.object({
  id: z.string().optional(), // present when updating
  baseUrl: z
    .string()
    .trim()
    .url("Enter a full URL, for example https://api.callvibe.ai")
    .optional()
    .or(z.literal("")),
  email: z.string().trim().email("Enter the CallVibe account's email address"),
  password: z.string().min(1, "Password is required"),
  /** Only needed to push call logs into CallVibe; read from GET /api/tenant/info. */
  tenantId: z.string().trim().optional().or(z.literal("")),
  pushToken: z.string().trim().optional().or(z.literal("")),
  syncEnabled: z.boolean().default(true),
  syncWindowHours: z.coerce
    .number()
    .int()
    .min(1, "At least one hour")
    .max(720, "At most 30 days")
    .default(24),
  isActive: z.boolean().default(true),
});

export type CallVibeConfigInput = z.infer<typeof callVibeConfigSchema>;
