import { z } from "zod";

// ============================================================
// Contract Schema
// ============================================================

export const contractSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be at most 200 characters"),
  content: z
    .string()
    .min(1, "Contract content is required"),
  contactId: z.string().min(1, "Contact is required"),
  bookingId: z
    .string()
    .optional()
    .or(z.literal("")),
  templateId: z
    .string()
    .optional()
    .or(z.literal("")),
  signerName: z
    .string()
    .max(200, "Signer name must be at most 200 characters")
    .optional()
    .or(z.literal("")),
  signerEmail: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  expiresAt: z.coerce
    .date()
    .optional()
    .nullable(),
  notes: z
    .string()
    .max(2000, "Notes must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
});

export type ContractInput = z.infer<typeof contractSchema>;

// ============================================================
// Contract Template Schema
// ============================================================

export const contractTemplateSchema = z.object({
  name: z
    .string()
    .min(1, "Template name is required")
    .max(200, "Name must be at most 200 characters"),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional()
    .or(z.literal("")),
  content: z
    .string()
    .min(1, "Template content is required"),
  variables: z
    .array(z.string())
    .default([]),
  category: z
    .string()
    .max(100, "Category must be at most 100 characters")
    .optional()
    .or(z.literal("")),
  isActive: z.boolean().default(true),
});

export type ContractTemplateInput = z.infer<typeof contractTemplateSchema>;
