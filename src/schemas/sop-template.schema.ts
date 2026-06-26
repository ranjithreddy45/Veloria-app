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

// ============================================================
// Provisioning seeds — these JSON shapes are consumed VERBATIM by
// src/lib/ops/provision.ts when a booking is confirmed. Do NOT change a field
// name without updating that consumer.
// ============================================================

// kitchenSeed → KitchenPlan items: [{ name, category, quantity, unit, estUnitCost }]
export const kitchenSeedItemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(300),
  category: z.string().max(120).optional().or(z.literal("")),
  quantity: z.number().min(0).optional(),
  unit: z.string().max(60).optional().or(z.literal("")),
  estUnitCost: z.number().min(0).optional(),
});

// procurementSeed → PurchaseRequisition (neededBy = eventDate − neededByOffsetDays)
export const procurementSeedItemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(300),
  quantity: z.number().min(0).optional(),
  unit: z.string().max(60).optional().or(z.literal("")),
  unitPrice: z.number().min(0).optional(),
});

export const procurementSeedSchema = z.object({
  title: z.string().min(1, "Requisition title is required").max(300),
  department: z.string().max(120).optional().or(z.literal("")),
  neededByOffsetDays: z.number().int().min(0).optional(),
  items: z.array(procurementSeedItemSchema).optional(),
});

// dispatchSeed → DispatchOrder: [{ fromLocation, toLocation, items: [{ name, quantity, returnable }] }]
export const dispatchSeedItemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(300),
  quantity: z.number().min(0).optional(),
  returnable: z.boolean().optional(),
});

export const dispatchSeedSchema = z.object({
  fromLocation: z.string().max(200).optional().or(z.literal("")),
  toLocation: z.string().max(200).optional().or(z.literal("")),
  items: z.array(dispatchSeedItemSchema).optional(),
});

// beoDefaults → BEO notes
export const beoDefaultsSchema = z.object({
  menuNotes: z.string().max(5000).optional().or(z.literal("")),
  floorPlanNotes: z.string().max(5000).optional().or(z.literal("")),
  avNotes: z.string().max(5000).optional().or(z.literal("")),
  decorNotes: z.string().max(5000).optional().or(z.literal("")),
  staffingNotes: z.string().max(5000).optional().or(z.literal("")),
  specialInstructions: z.string().max(5000).optional().or(z.literal("")),
});

export const updateSOPTemplateSeedsSchema = z.object({
  kitchenSeed: z.array(kitchenSeedItemSchema).nullable().optional(),
  procurementSeed: z.array(procurementSeedSchema).nullable().optional(),
  dispatchSeed: z.array(dispatchSeedSchema).nullable().optional(),
  beoDefaults: beoDefaultsSchema.nullable().optional(),
});

export type KitchenSeedItem = z.infer<typeof kitchenSeedItemSchema>;
export type ProcurementSeed = z.infer<typeof procurementSeedSchema>;
export type DispatchSeed = z.infer<typeof dispatchSeedSchema>;
export type BeoDefaults = z.infer<typeof beoDefaultsSchema>;
export type UpdateSOPTemplateSeedsInput = z.infer<
  typeof updateSOPTemplateSeedsSchema
>;
