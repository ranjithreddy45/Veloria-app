import { z } from "zod";

// ============================================================
// Blueprint Transition Schema
// ============================================================

export const blueprintTransitionSchema = z.object({
  fromStatus: z.string().min(1, "From status is required"),
  toStatus: z.string().min(1, "To status is required"),
  name: z.string().optional(),
  requiredFields: z.array(z.string()).default([]),
  requiredActions: z.array(z.string()).default([]),
  allowedRoles: z.array(z.string()).default([]),
  conditions: z.array(z.record(z.string(), z.unknown())).default([]),
  isActive: z.boolean().default(true),
  order: z.number().int().default(0),
});

// ============================================================
// Blueprint Schema
// ============================================================

export const blueprintSchema = z.object({
  name: z.string().min(1, "Blueprint name is required").max(100),
  entityType: z.enum(["LEAD", "DEAL", "BOOKING"]),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  isPublished: z.boolean().default(false),
});

// ============================================================
// Types
// ============================================================

export type BlueprintInput = z.input<typeof blueprintSchema>;
export type BlueprintTransitionInput = z.input<typeof blueprintTransitionSchema>;
