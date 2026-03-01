import { z } from "zod";

export const createExecutionPlanSchema = z.object({
  bookingId: z.string().min(1, "Booking is required"),
  sopTemplateId: z.string().optional().or(z.literal("")),
  eventDate: z.coerce.date(),
  startTime: z.string().optional().or(z.literal("")),
  endTime: z.string().optional().or(z.literal("")),
  notes: z.string().max(5000).optional().or(z.literal("")),
});

export type CreateExecutionPlanInput = z.infer<typeof createExecutionPlanSchema>;

export const updatePlanStatusSchema = z.object({
  status: z.enum(["PLANNING", "READY", "LIVE", "COMPLETED"]),
});

export type UpdatePlanStatusInput = z.infer<typeof updatePlanStatusSchema>;

export const addPhaseSchema = z.object({
  name: z.string().min(1, "Phase name is required").max(200),
  phase: z.enum(["PRE_EVENT", "SETUP", "GUEST_ARRIVAL", "LIVE_EVENT", "WRAP_UP", "HANDOVER"]),
  order: z.number().int().min(0).optional(),
  description: z.string().max(2000).optional().or(z.literal("")),
  plannedStart: z.coerce.date().optional().nullable(),
  plannedEnd: z.coerce.date().optional().nullable(),
});

export type AddPhaseInput = z.infer<typeof addPhaseSchema>;

export const updatePhaseSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().or(z.literal("")),
  plannedStart: z.coerce.date().optional().nullable(),
  plannedEnd: z.coerce.date().optional().nullable(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETED", "DELAYED"]).optional(),
});

export type UpdatePhaseInput = z.infer<typeof updatePhaseSchema>;
