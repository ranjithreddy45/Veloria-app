import { z } from "zod";

export const addExecutionTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().max(5000).optional().or(z.literal("")),
  category: z.enum(["DECOR", "AV", "CATERING", "HOUSEKEEPING", "GUEST_SEATING", "ENTERTAINMENT", "LOGISTICS", "SECURITY", "GENERAL"]).default("GENERAL"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  estimatedMinutes: z.number().int().positive().optional().nullable(),
  slaStartBy: z.coerce.date().optional().nullable(),
  slaFinishBy: z.coerce.date().optional().nullable(),
  isMandatory: z.boolean().default(false),
  requiresApproval: z.boolean().default(false),
  requiresProof: z.boolean().default(false),
  assigneeId: z.string().optional().or(z.literal("")),
  vendorId: z.string().optional().or(z.literal("")),
  dependsOnTaskId: z.string().optional().or(z.literal("")),
  order: z.number().int().min(0).optional(),
});

export type AddExecutionTaskInput = z.infer<typeof addExecutionTaskSchema>;

export const updateExecutionTaskSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional().or(z.literal("")),
  category: z.enum(["DECOR", "AV", "CATERING", "HOUSEKEEPING", "GUEST_SEATING", "ENTERTAINMENT", "LOGISTICS", "SECURITY", "GENERAL"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  estimatedMinutes: z.number().int().positive().optional().nullable(),
  slaStartBy: z.coerce.date().optional().nullable(),
  slaFinishBy: z.coerce.date().optional().nullable(),
  isMandatory: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
  requiresProof: z.boolean().optional(),
  assigneeId: z.string().optional().or(z.literal("")),
  vendorId: z.string().optional().or(z.literal("")),
  dependsOnTaskId: z.string().optional().or(z.literal("")),
});

export type UpdateExecutionTaskInput = z.infer<typeof updateExecutionTaskSchema>;

export const updateTaskStatusSchema = z.object({
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETED", "DELAYED"]),
  delayReason: z.string().max(2000).optional().or(z.literal("")),
});

export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;

export const assignTaskSchema = z.object({
  assigneeId: z.string().optional().or(z.literal("")),
  vendorId: z.string().optional().or(z.literal("")),
});

export type AssignTaskInput = z.infer<typeof assignTaskSchema>;

export const addProofSchema = z.object({
  type: z.enum(["PHOTO", "NOTE", "SIGN_OFF"]),
  content: z.string().min(1, "Content is required"),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export type AddProofInput = z.infer<typeof addProofSchema>;
