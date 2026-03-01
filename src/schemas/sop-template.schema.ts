import { z } from "zod";

export const createSOPTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(200),
  description: z.string().max(5000).optional().or(z.literal("")),
  eventType: z.string().optional().or(z.literal("")),
  isDefault: z.boolean().default(false),
});

export type CreateSOPTemplateInput = z.infer<typeof createSOPTemplateSchema>;

export const updateSOPTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().or(z.literal("")),
  eventType: z.string().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export type UpdateSOPTemplateInput = z.infer<typeof updateSOPTemplateSchema>;

export const addSOPPhaseSchema = z.object({
  name: z.string().min(1, "Phase name is required").max(200),
  phase: z.enum(["PRE_EVENT", "SETUP", "GUEST_ARRIVAL", "LIVE_EVENT", "WRAP_UP", "HANDOVER"]),
  order: z.number().int().min(0).optional(),
  description: z.string().max(2000).optional().or(z.literal("")),
});

export type AddSOPPhaseInput = z.infer<typeof addSOPPhaseSchema>;

export const updateSOPPhaseSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phase: z.enum(["PRE_EVENT", "SETUP", "GUEST_ARRIVAL", "LIVE_EVENT", "WRAP_UP", "HANDOVER"]).optional(),
  description: z.string().max(2000).optional().or(z.literal("")),
});

export type UpdateSOPPhaseInput = z.infer<typeof updateSOPPhaseSchema>;

export const addSOPTaskDefSchema = z.object({
  title: z.string().min(1, "Task title is required").max(300),
  description: z.string().max(5000).optional().or(z.literal("")),
  category: z.enum(["DECOR", "AV", "CATERING", "HOUSEKEEPING", "GUEST_SEATING", "ENTERTAINMENT", "LOGISTICS", "SECURITY", "GENERAL"]).default("GENERAL"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  estimatedMinutes: z.number().int().positive().optional().nullable(),
  isMandatory: z.boolean().default(false),
  requiresApproval: z.boolean().default(false),
  requiresProof: z.boolean().default(false),
  order: z.number().int().min(0).optional(),
  checklistItems: z.array(z.object({ title: z.string().min(1), order: z.number().int().min(0) })).optional(),
  dependsOnTaskOrder: z.number().int().min(0).optional().nullable(),
});

export type AddSOPTaskDefInput = z.infer<typeof addSOPTaskDefSchema>;

export const updateSOPTaskDefSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional().or(z.literal("")),
  category: z.enum(["DECOR", "AV", "CATERING", "HOUSEKEEPING", "GUEST_SEATING", "ENTERTAINMENT", "LOGISTICS", "SECURITY", "GENERAL"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  estimatedMinutes: z.number().int().positive().optional().nullable(),
  isMandatory: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
  requiresProof: z.boolean().optional(),
  checklistItems: z.array(z.object({ title: z.string().min(1), order: z.number().int().min(0) })).optional(),
  dependsOnTaskOrder: z.number().int().min(0).optional().nullable(),
});

export type UpdateSOPTaskDefInput = z.infer<typeof updateSOPTaskDefSchema>;
