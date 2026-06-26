// ============================================================
// Site-visit booking — input schemas (zod).
// ------------------------------------------------------------
// submitVisitBookingSchema validates UNTRUSTED public input (the /visit
// scheduler is unauthenticated). updateSiteVisitStatusSchema gates internal
// status transitions. Types/zod live here, not in any "use server" file
// (those export only async functions). Mirrors public-hold.schema /
// cadence convention.
// ============================================================

import { z } from "zod";

export const SITE_VISIT_KINDS = ["SITE_VISIT", "MENU_TASTING"] as const;

export const SITE_VISIT_STATUSES = [
  "REQUESTED",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "RESCHEDULED",
] as const;

/** ISO timestamp string that parses to a real, finite Date. */
const isoDateTime = z
  .string()
  .min(1, "Please choose a time.")
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Pick a valid time.");

/**
 * India phone normalize: keep digits, accept +country / 0 prefixes, require a
 * usable number. We store the cleaned form for dedupe + WhatsApp.
 */
const phone = z
  .string()
  .trim()
  .min(1, "Please enter your phone number.")
  .refine((v) => v.replace(/\D/g, "").length >= 7, "Enter a valid phone number.");

export const submitVisitBookingSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(120),
  phone,
  email: z.string().trim().email("Enter a valid email.").optional().or(z.literal("")),
  kind: z.enum(SITE_VISIT_KINDS),
  scheduledAt: isoDateTime,
  venueId: z.string().trim().min(1).optional().or(z.literal("")),
  eventType: z.string().trim().max(80).optional().or(z.literal("")),
  guestCount: z.coerce.number().int().min(1).max(100000).optional(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  utmSource: z.string().trim().max(120).optional().or(z.literal("")),
  utmMedium: z.string().trim().max(120).optional().or(z.literal("")),
  utmCampaign: z.string().trim().max(120).optional().or(z.literal("")),
});

export type SubmitVisitBookingInput = z.input<typeof submitVisitBookingSchema>;
export type SubmitVisitBookingParsed = z.infer<typeof submitVisitBookingSchema>;

export const updateSiteVisitStatusSchema = z.object({
  status: z.enum(["COMPLETED", "CANCELLED", "NO_SHOW", "RESCHEDULED", "CONFIRMED"]),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  scheduledAt: isoDateTime.optional(),
});

export type UpdateSiteVisitStatusInput = z.infer<typeof updateSiteVisitStatusSchema>;

/** Normalize an India phone for dedupe/storage: strip non-digits, keep last 12. */
export function normalizeVisitPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length > 12 ? digits.slice(-12) : digits;
}
