import { z } from "zod";

// ============================================================
// Invoice Line Item Schema
// ============================================================

export const invoiceLineItemSchema = z.object({
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
});

// ============================================================
// Invoice Schema
// ============================================================

export const invoiceSchema = z.object({
  contactId: z.string().min(1, "Contact is required"),
  bookingId: z
    .string()
    .optional()
    .or(z.literal("")),
  dueDate: z.coerce.date({
    error: "Due date is required",
  }),
  lineItems: z
    .array(invoiceLineItemSchema)
    .min(1, "At least one line item is required"),
  discountPercent: z
    .number()
    .min(0, "Discount cannot be negative")
    .max(100, "Discount cannot exceed 100%")
    .optional()
    .nullable(),
  cgstRate: z
    .number()
    .min(0, "CGST rate cannot be negative")
    .max(100, "CGST rate cannot exceed 100%")
    .default(9),
  sgstRate: z
    .number()
    .min(0, "SGST rate cannot be negative")
    .max(100, "SGST rate cannot exceed 100%")
    .default(9),
  igstRate: z
    .number()
    .min(0, "IGST rate cannot be negative")
    .max(100, "IGST rate cannot exceed 100%")
    .default(0),
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
  gstin: z
    .string()
    .max(15, "GSTIN must be at most 15 characters")
    .regex(
      /^$|^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      "Please enter a valid GSTIN"
    )
    .optional()
    .or(z.literal("")),
  placeOfSupply: z
    .string()
    .max(100, "Place of supply must be at most 100 characters")
    .optional()
    .or(z.literal("")),
});

export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type InvoiceLineItemInput = z.infer<typeof invoiceLineItemSchema>;
