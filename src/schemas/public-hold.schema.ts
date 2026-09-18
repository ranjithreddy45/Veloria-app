// ============================================================
// Public Availability Hold — input schema (UNTRUSTED public input).
// ------------------------------------------------------------
// createPublicHold is ungated (no auth), so every field below is validated
// server-side before any DB write. Types/zod and the pure per-customer cap rule
// live here (not in the "use server" action file, which may export only async
// functions); both are unit-tested in public-hold.schema.test.ts.
// ============================================================

import { z } from "zod";

export const PUBLIC_HOLD_SLOTS = ["MORNING", "AFTERNOON", "EVENING", "FULL_DAY"] as const;

/** Longest event type a hold accepts. */
export const PUBLIC_HOLD_EVENT_TYPE_MAX = 80;
/**
 * Longest customer name a hold accepts. The HOLD booking's event name is built
 * from it ("<event type> — <name>"), which therefore stays within 80 + 3 + 80
 * = 163 characters.
 */
export const PUBLIC_HOLD_NAME_MAX = 80;

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
  eventType: z.string().trim().max(PUBLIC_HOLD_EVENT_TYPE_MAX).optional(),
  guestCount: z.coerce.number().int().min(1, "Guest count must be at least 1.").max(100000),
  customerName: z
    .string()
    .trim()
    .min(2, "Please enter your name.")
    .max(PUBLIC_HOLD_NAME_MAX, `Please keep your name to ${PUBLIC_HOLD_NAME_MAX} characters or fewer.`),
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
  // DPDP consent — required (enforced in the action; optional in the schema so
  // the inferred input type does not force every caller to pass it).
  consent: z.boolean().optional(),
});

export type PublicHoldInput = z.infer<typeof publicHoldSchema>;

// ============================================================
// Per-customer hold caps (enforced in placeHold, public-hold.actions.ts).
// ------------------------------------------------------------
// The IP limit is per process and an IP is cheap to change, so each phone
// number, and separately each email address, may place at most
// MAX_PUBLIC_HOLDS_PER_CUSTOMER new holds in any PUBLIC_HOLD_CAP_WINDOW_HOURS.
// Every hold row counts, released and lapsed ones too.
// ============================================================

export const MAX_PUBLIC_HOLDS_PER_CUSTOMER = 3;
export const PUBLIC_HOLD_CAP_WINDOW_HOURS = 24;

export interface PublicHoldCounts {
  /** Holds placed in the window with this phone number, compared digit-normalised. */
  byPhone: number;
  /** Holds placed in the window with this email, case-insensitive (0 when none was given). */
  byEmail: number;
}

export const PUBLIC_HOLD_CAP_MESSAGE =
  `You've already placed ${MAX_PUBLIC_HOLDS_PER_CUSTOMER} date holds in the last ${PUBLIC_HOLD_CAP_WINDOW_HOURS} hours ` +
  "with this phone number or email. To hold another date, please contact us or try again tomorrow.";

/** The customer message once the phone number or the email has used its holds; null while both are under the cap. */
export function publicHoldCapError(counts: PublicHoldCounts): string | null {
  return counts.byPhone >= MAX_PUBLIC_HOLDS_PER_CUSTOMER || counts.byEmail >= MAX_PUBLIC_HOLDS_PER_CUSTOMER
    ? PUBLIC_HOLD_CAP_MESSAGE
    : null;
}
