import { z } from "zod";

export const assignmentRuleConditionSchema = z.object({
  field: z.string().min(1, "Field is required"),
  operator: z.enum(["equals", "contains", "in", "notIn", "gt", "lt", "gte", "lte"]),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
});

export const assignmentRuleSchema = z.object({
  name: z.string().min(1, "Rule name is required").max(100),
  entityType: z.string().default("LEAD"),
  isActive: z.boolean().default(true),
  priority: z.number().int().min(0).default(0),
  conditions: z.array(assignmentRuleConditionSchema).min(1, "At least one condition is required"),
  assignToUserId: z.string().optional().nullable(),
  assignToTeam: z.array(z.string()).default([]),
  assignmentMethod: z.enum(["DIRECT", "ROUND_ROBIN"]).default("DIRECT"),
});

export type AssignmentRuleInput = z.input<typeof assignmentRuleSchema>;
export type AssignmentRuleCondition = z.infer<typeof assignmentRuleConditionSchema>;
