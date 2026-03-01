import { z } from "zod";

// ============================================================
// Approval Rule Condition
// ============================================================

export const approvalConditionSchema = z.object({
  field: z.string().min(1, "Field is required"),
  operator: z.enum(["equals", "contains", "in", "notIn", "gt", "lt", "gte", "lte"]),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
});

// ============================================================
// Approval Rule
// ============================================================

export const approvalRuleSchema = z.object({
  name: z.string().min(1, "Rule name is required").max(100),
  entityType: z.enum(["QUOTE", "DEAL", "BOOKING"]),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  priority: z.number().int().min(0).default(0),
  conditions: z.array(approvalConditionSchema).default([]),
});

// ============================================================
// Approval Chain Step
// ============================================================

export const approvalChainStepSchema = z.object({
  order: z.number().int().min(0),
  approverType: z.enum(["USER", "ROLE"]),
  approverId: z.string().min(1, "Approver is required"),
  isOptional: z.boolean().default(false),
});

// ============================================================
// Approval Decision
// ============================================================

export const approvalDecisionSchema = z.object({
  action: z.enum(["APPROVE", "REJECT", "DELEGATE"]),
  comment: z.string().optional().nullable(),
  delegatedToId: z.string().optional().nullable(),
});

// ============================================================
// Exported Types
// ============================================================

export type ApprovalRuleInput = z.input<typeof approvalRuleSchema>;
export type ApprovalChainStepInput = z.input<typeof approvalChainStepSchema>;
export type ApprovalDecisionInput = z.input<typeof approvalDecisionSchema>;
export type ApprovalCondition = z.infer<typeof approvalConditionSchema>;
