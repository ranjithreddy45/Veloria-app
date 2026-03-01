import { z } from "zod";

// ============================================================
// Communication Type & Direction Enum Values (matching Prisma)
// ============================================================

const communicationTypeValues = [
  "NOTE",
  "CALL",
  "EMAIL",
  "SMS",
  "MEETING",
  "WHATSAPP",
] as const;

const communicationDirectionValues = ["INBOUND", "OUTBOUND"] as const;

// ============================================================
// Log Communication Schema
// ============================================================

export const logCommunicationSchema = z.object({
  type: z.enum(communicationTypeValues, {
    error: "Please select a communication type",
  }),
  subject: z
    .string()
    .max(200, "Subject must be at most 200 characters")
    .optional()
    .or(z.literal("")),
  content: z
    .string()
    .min(1, "Content is required")
    .max(10000, "Content must be at most 10,000 characters"),
  direction: z.enum(communicationDirectionValues).default("OUTBOUND"),
  contactId: z.string().min(1, "Contact is required"),
  bookingId: z.string().optional().or(z.literal("")),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type LogCommunicationInput = z.infer<typeof logCommunicationSchema>;

// ============================================================
// List Communications Filter Schema
// ============================================================

export const listCommunicationsSchema = z.object({
  contactId: z.string().optional(),
  bookingId: z.string().optional(),
  type: z.enum(communicationTypeValues).optional(),
});

export type ListCommunicationsInput = z.infer<typeof listCommunicationsSchema>;
