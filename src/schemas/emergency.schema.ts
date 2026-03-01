import { z } from "zod";

// ============================================================
// Emergency Type Values
// ============================================================

const emergencyTypeValues = [
  "FIRE",
  "MEDICAL",
  "WEATHER",
  "SECURITY",
  "POWER_OUTAGE",
  "OTHER",
] as const;

// ============================================================
// Emergency Severity Values
// ============================================================

const emergencySeverityValues = ["HIGH", "MEDIUM", "LOW"] as const;

// ============================================================
// Contact Number Entry Schema
// ============================================================

const contactNumberSchema = z.object({
  name: z.string().min(1, "Contact name is required"),
  phone: z.string().min(1, "Phone number is required"),
  role: z.string().min(1, "Role is required"),
});

// ============================================================
// Emergency Protocol Create/Update Schema
// ============================================================

export const emergencyProtocolSchema = z.object({
  name: z
    .string()
    .min(1, "Protocol name is required")
    .max(200, "Name must be at most 200 characters"),
  type: z.enum(emergencyTypeValues, {
    error: "Emergency type is required",
  }),
  venueId: z.string().optional().or(z.literal("")),
  procedures: z
    .string()
    .min(1, "Procedures are required")
    .max(10000, "Procedures must be at most 10000 characters"),
  contactNumbers: z.array(contactNumberSchema).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

export type EmergencyProtocolInput = z.infer<typeof emergencyProtocolSchema>;

// ============================================================
// Emergency Incident Report Schema
// ============================================================

export const emergencyIncidentSchema = z.object({
  bookingId: z.string().optional().or(z.literal("")),
  protocolId: z.string().optional().or(z.literal("")),
  type: z.enum(emergencyTypeValues, {
    error: "Emergency type is required",
  }),
  description: z
    .string()
    .min(1, "Description is required")
    .max(5000, "Description must be at most 5000 characters"),
  severity: z.enum(emergencySeverityValues, {
    error: "Severity is required",
  }),
});

export type EmergencyIncidentInput = z.infer<typeof emergencyIncidentSchema>;

// ============================================================
// Resolve Incident Schema
// ============================================================

export const resolveIncidentSchema = z.object({
  notes: z
    .string()
    .max(5000, "Notes must be at most 5000 characters")
    .optional()
    .or(z.literal("")),
});

export type ResolveIncidentInput = z.infer<typeof resolveIncidentSchema>;

export { emergencyTypeValues, emergencySeverityValues };
