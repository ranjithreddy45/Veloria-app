import { z } from "zod";

// ============================================================
// Tally Configuration Schema
// ============================================================

export const tallyConfigSchema = z.object({
  apiKey: z.string().min(1, { error: "API Key is required" }),
  companyId: z.string().min(1, { error: "Company ID is required" }),
  autoSync: z.boolean(),
});

export type TallyConfigInput = z.infer<typeof tallyConfigSchema>;

// ============================================================
// Trigger Sync Schema
// ============================================================

const syncTypeValues = ["INVOICE", "PAYMENT", "PAYOUT"] as const;

export const triggerSyncSchema = z.object({
  type: z.enum(syncTypeValues, {
    error: "Sync type must be INVOICE, PAYMENT, or PAYOUT",
  }),
  entityId: z.string().min(1, { error: "Entity ID is required" }),
});

export type TriggerSyncInput = z.infer<typeof triggerSyncSchema>;
