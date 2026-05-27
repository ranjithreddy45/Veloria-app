import { z } from "zod";

// ============================================================
// Call Disposition Values (matching Prisma enum)
// ============================================================

const callDispositionValues = [
  "COMPLETED",
  "NO_ANSWER",
  "BUSY",
  "VOICEMAIL",
  "WRONG_NUMBER",
  "CALLBACK_REQUESTED",
] as const;

const callDirectionValues = ["INBOUND", "OUTBOUND"] as const;

// ============================================================
// Log Call Schema
// ============================================================

export const logCallSchema = z.object({
  contactId: z.string().min(1, "Contact is required"),
  direction: z.enum(callDirectionValues).default("OUTBOUND"),
  disposition: z.enum(callDispositionValues, {
    error: "Please select a call disposition",
  }),
  durationSeconds: z.coerce.number().int().min(0).default(0),
  notes: z
    .string()
    .max(5000, "Notes must be at most 5,000 characters")
    .optional()
    .or(z.literal("")),
  tags: z.array(z.string()).default([]),
  followUpDate: z.coerce.date().optional().nullable(),
  followUpNotes: z
    .string()
    .max(2000, "Follow-up notes must be at most 2,000 characters")
    .optional()
    .or(z.literal("")),
  bookingId: z.string().optional().or(z.literal("")),
  recordingUrl: z.string().url().optional().or(z.literal("")),
  externalCallId: z.string().optional().or(z.literal("")),
});

export type LogCallInput = z.infer<typeof logCallSchema>;

// ============================================================
// Call Filters Schema
// ============================================================

export const callFiltersSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  direction: z.enum(callDirectionValues).optional(),
  disposition: z.enum(callDispositionValues).optional(),
  agentId: z.string().optional(),
  contactId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CallFiltersInput = z.infer<typeof callFiltersSchema>;
