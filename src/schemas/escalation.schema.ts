import { z } from "zod";

export const createEscalationRuleSchema = z.object({
  name: z.string().min(1, "Rule name is required").max(200),
  category: z.enum(["DECOR", "AV", "CATERING", "HOUSEKEEPING", "GUEST_SEATING", "ENTERTAINMENT", "LOGISTICS", "SECURITY", "GENERAL"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  delayThresholdMinutes: z.number().int().positive("Threshold must be positive"),
  level: z.enum(["L1_SUPERVISOR", "L2_MANAGER", "L3_LEADERSHIP"]),
  notifyUserIds: z.array(z.string()).default([]),
  notifyRoles: z.array(z.string()).default([]),
});

export type CreateEscalationRuleInput = z.infer<typeof createEscalationRuleSchema>;

export const updateEscalationRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: z.enum(["DECOR", "AV", "CATERING", "HOUSEKEEPING", "GUEST_SEATING", "ENTERTAINMENT", "LOGISTICS", "SECURITY", "GENERAL"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  delayThresholdMinutes: z.number().int().positive().optional(),
  level: z.enum(["L1_SUPERVISOR", "L2_MANAGER", "L3_LEADERSHIP"]).optional(),
  notifyUserIds: z.array(z.string()).optional(),
  notifyRoles: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateEscalationRuleInput = z.infer<typeof updateEscalationRuleSchema>;

export const resolveEscalationSchema = z.object({
  resolutionNotes: z.string().min(1, "Resolution notes required").max(5000),
});

export type ResolveEscalationInput = z.infer<typeof resolveEscalationSchema>;
