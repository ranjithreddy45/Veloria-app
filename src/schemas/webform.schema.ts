import { z } from "zod";

// ============================================================
// Field Type Enum
// ============================================================

const fieldTypeValues = [
  "TEXT",
  "EMAIL",
  "PHONE",
  "NUMBER",
  "DATE",
  "SELECT",
  "TEXTAREA",
] as const;

// ============================================================
// Webform Field Schema
// ============================================================

export const webformFieldSchema = z.object({
  type: z.enum(fieldTypeValues),
  label: z.string().min(1, "Label is required").max(100),
  name: z
    .string()
    .min(1, "Field name is required")
    .max(50)
    .regex(
      /^[a-zA-Z_][a-zA-Z0-9_]*$/,
      "Field name must start with a letter or underscore and contain only letters, numbers, and underscores"
    ),
  required: z.boolean().default(false),
  placeholder: z.string().max(200).optional().or(z.literal("")),
  options: z
    .array(z.string().min(1))
    .optional()
    .nullable(),
});

export type WebformField = z.infer<typeof webformFieldSchema>;

// ============================================================
// Lead Source Values (matching Prisma LeadSource enum)
// ============================================================

const leadSourceValues = [
  "WEBSITE",
  "REFERRAL",
  "SOCIAL_MEDIA",
  "WALK_IN",
  "PHONE_INQUIRY",
  "EMAIL",
  "EVENT",
  "PARTNER",
  "ADVERTISEMENT",
  "OTHER",
] as const;

// ============================================================
// Webform Schema
// ============================================================

export const webformSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be at most 200 characters"),
  slug: z
    .string()
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be URL-friendly (lowercase letters, numbers, hyphens)")
    .optional()
    .or(z.literal("")),
  description: z
    .string()
    .max(2000, "Description must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
  fields: z
    .array(webformFieldSchema)
    .min(1, "At least one field is required"),
  styling: z.record(z.string(), z.unknown()).optional().nullable(),
  thankYouUrl: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
  thankYouMessage: z
    .string()
    .max(2000, "Thank you message must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
  notifyUserIds: z.array(z.string()).optional().default([]),
  autoAssignTo: z.string().optional().or(z.literal("")),
  defaultSource: z.enum(leadSourceValues).default("WEBSITE"),
  honeypotField: z
    .string()
    .max(50)
    .optional()
    .or(z.literal("")),
  isActive: z.boolean().default(true),
});

export type WebformInput = z.infer<typeof webformSchema>;

// ============================================================
// Webform Submission Schema (for public API)
// ============================================================

export const webformSubmissionSchema = z.object({
  data: z.record(z.string(), z.unknown()),
  honeypot: z.string().optional(),
});

export type WebformSubmissionInput = z.infer<typeof webformSubmissionSchema>;
