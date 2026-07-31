import { z } from "zod";

// ============================================================
// Contact Schema
// ============================================================

export const contactSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(100, "First name must be at most 100 characters"),
  lastName: z
    .string()
    .max(100, "Last name must be at most 100 characters")
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .email("Please enter a valid email address")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .min(7, "Phone number is required")
    .max(20, "Phone number must be at most 20 characters"),
  company: z
    .string()
    .max(200, "Company name must be at most 200 characters")
    .optional()
    .or(z.literal("")),
  designation: z
    .string()
    .max(100, "Designation must be at most 100 characters")
    .optional()
    .or(z.literal("")),
  type: z.enum(["INDIVIDUAL", "CORPORATE"]).default("INDIVIDUAL"),
  address: z
    .string()
    .max(500, "Address must be at most 500 characters")
    .optional()
    .or(z.literal("")),
  city: z
    .string()
    .max(100, "City must be at most 100 characters")
    .optional()
    .or(z.literal("")),
  state: z
    .string()
    .max(100, "State must be at most 100 characters")
    .optional()
    .or(z.literal("")),
  pincode: z
    .string()
    .max(10, "Pincode must be at most 10 characters")
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .max(2000, "Notes must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
  tags: z.array(z.string()).default([]),
  // Hall/Property this enquiry is about. Empty string → cleared (stored null).
  enquiryVenueId: z
    .string()
    .optional()
    .or(z.literal("")),
  // Marketing channel to credit. Captured enquiries set this automatically;
  // this is the manual path for walk-ins and phone calls.
  enquirySource: z
    .enum(["DIRECT", "GOOGLE_ADS", "PAID_SOCIAL", "LEAD_FORM"])
    .optional()
    .or(z.literal("")),
});

export type ContactInput = z.infer<typeof contactSchema>;
