import { z } from "zod";

// ============================================================
// Exit Criteria
// ============================================================

export const exitCriterionSchema = z.object({
  type: z.enum(["STATUS_CHANGE", "REPLY_RECEIVED"]),
  values: z.array(z.string()).default([]),
});

// ============================================================
// Auto-Enroll Criteria
// ============================================================

export const autoEnrollCriterionSchema = z.object({
  field: z.string().min(1, "Field is required"),
  operator: z.enum(["equals", "contains", "in", "notIn", "gt", "lt", "gte", "lte"]),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
});

// ============================================================
// Cadence Schema
// ============================================================

export const cadenceSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  description: z.string().optional(),
  entityType: z.enum(["LEAD", "CONTACT"]).default("LEAD"),
  exitCriteria: z.array(exitCriterionSchema).default([]),
  autoEnroll: z.boolean().default(false),
  autoEnrollCriteria: z.array(autoEnrollCriterionSchema).optional(),
});

// ============================================================
// Cadence Step Schema
// ============================================================

export const cadenceStepSchema = z.object({
  stepType: z.enum(["SEND_EMAIL", "CREATE_TASK", "SEND_WHATSAPP", "WAIT", "LOG_NOTE"]),
  config: z.record(z.string(), z.unknown()).default({}),
  delayDays: z.number().int().min(0).default(0),
  delayHours: z.number().int().min(0).default(0),
  order: z.number().int().min(0),
});

// ============================================================
// Types
// ============================================================

export type CadenceInput = z.input<typeof cadenceSchema>;
export type CadenceStepInput = z.input<typeof cadenceStepSchema>;
export type ExitCriterion = z.infer<typeof exitCriterionSchema>;
export type AutoEnrollCriterion = z.infer<typeof autoEnrollCriterionSchema>;
