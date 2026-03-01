import { z } from "zod";

// ============================================================
// Quote Line Item Schema
// ============================================================

export const quoteLineItemSchema = z.object({
  description: z
    .string()
    .min(1, "Line item description is required")
    .max(500, "Description must be at most 500 characters"),
  quantity: z
    .number({
      error: "Quantity must be a number",
    })
    .positive("Quantity must be positive"),
  unitPrice: z
    .number({
      error: "Unit price must be a number",
    })
    .positive("Unit price must be positive"),
  category: z
    .string()
    .max(100, "Category must be at most 100 characters")
    .optional()
    .or(z.literal("")),
});

// ============================================================
// Quote Schema
// ============================================================

export const quoteSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be at most 200 characters"),
  contactId: z.string().min(1, "Contact is required"),
  leadId: z
    .string()
    .optional()
    .or(z.literal("")),
  packageId: z
    .string()
    .optional()
    .or(z.literal("")),
  validUntil: z.coerce.date({
    error: "Valid until date is required",
  }),
  lineItems: z
    .array(quoteLineItemSchema)
    .min(1, "At least one line item is required"),
  discountPercent: z
    .number()
    .min(0, "Discount cannot be negative")
    .max(100, "Discount cannot exceed 100%")
    .optional()
    .nullable(),
  taxRate: z
    .number()
    .min(0, "Tax rate cannot be negative")
    .max(100, "Tax rate cannot exceed 100%")
    .default(18),
  notes: z
    .string()
    .max(2000, "Notes must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
  terms: z
    .string()
    .max(5000, "Terms must be at most 5000 characters")
    .optional()
    .or(z.literal("")),
  coverLetter: z
    .string()
    .max(5000, "Cover letter must be at most 5000 characters")
    .optional()
    .or(z.literal("")),
});

export type QuoteInput = z.infer<typeof quoteSchema>;
export type QuoteLineItemInput = z.infer<typeof quoteLineItemSchema>;
