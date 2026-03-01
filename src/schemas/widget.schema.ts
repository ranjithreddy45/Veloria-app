import { z } from "zod";
import { EVENT_TYPES } from "@/lib/constants";

// ============================================================
// Widget Inquiry Schema (Public Form Submission)
// ============================================================

export const widgetInquirySchema = z.object({
  name: z
    .string()
    .min(1, { error: "Name is required" })
    .max(200, { error: "Name must be at most 200 characters" }),
  email: z
    .string()
    .min(1, { error: "Email is required" })
    .email({ error: "Please enter a valid email address" }),
  phone: z
    .string()
    .max(20, { error: "Phone number must be at most 20 characters" })
    .optional()
    .or(z.literal("")),
  eventType: z
    .enum(EVENT_TYPES)
    .optional(),
  eventDate: z.coerce
    .date()
    .optional()
    .nullable(),
  guestCount: z
    .number()
    .int({ error: "Guest count must be a whole number" })
    .positive({ error: "Guest count must be positive" })
    .optional()
    .nullable(),
  venueId: z
    .string()
    .optional()
    .or(z.literal("")),
  message: z
    .string()
    .min(1, { error: "Message is required" })
    .max(5000, { error: "Message must be at most 5000 characters" }),
});

export type WidgetInquiryInput = z.infer<typeof widgetInquirySchema>;

// ============================================================
// Process Inquiry Schema (Dashboard action)
// ============================================================

export const processInquirySchema = z.object({
  id: z.string().min(1, { error: "Inquiry ID is required" }),
});

export type ProcessInquiryInput = z.infer<typeof processInquirySchema>;
