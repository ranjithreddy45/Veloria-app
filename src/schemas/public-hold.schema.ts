// ============================================================
// Public Availability Hold — input schema (UNTRUSTED public input).
// ------------------------------------------------------------
// createPublicHold is ungated (no auth), so every field below is validated
// server-side before any DB write. Types/zod live here (not in the
// "use server" action file, which may export only async functions).
// ============================================================

import { z } from "zod";

export const PUBLIC_HOLD_SLOTS = ["MORNING", "AFTERNOON", "EVENING", "FULL_DAY"] as const;

/**
 * YYYY-MM-DD only. We deliberately reject free-form date strings so the
 * public conflict scan parses the same local-midnight Date the engine uses.
 */
const dateISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date (YYYY-MM-DD).");

export const publicHoldSchema = z.object({
  venueId: z.string().min(1, "Please choose a venue."),
  dateISO,
  timeSlot: z.enum(PUBLIC_HOLD_SLOTS),
  eventType: z.string().trim().max(80).optional(),
  guestCount: z.coerce.number().int().min(1, "Guest count must be at least 1.").max(100000),
  customerName: z.string().trim().min(2, "Please enter your name."),
  // Allow +, spaces, hyphens, brackets in display form; require >= 7 actual digits.
  customerPhone: z
    .string()
    .trim()
    .min(1, "Please enter your phone number.")
    .refine((v) => (v.replace(/\D/g, "").length >= 7), "Enter a valid phone number."),
  customerEmail: z.string().trim().email("Enter a valid email.").optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional(),
  utmSource: z.string().trim().max(120).optional(),
  utmMedium: z.string().trim().max(120).optional(),
  utmCampaign: z.string().trim().max(120).optional(),
});

export type PublicHoldInput = z.infer<typeof publicHoldSchema>;
