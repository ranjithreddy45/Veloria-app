import { z } from "zod";

// ============================================================
// Lead Source Enum Values (matching Prisma LeadSource)
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
  "FACEBOOK_ADS",
  "GOOGLE_ADS",
  "INDIAMART",
  "JUSTDIAL",
  "WEDMEGOOD",
  "INSTAGRAM",
  "WHATSAPP",
  "OTHER",
] as const;

// ============================================================
// Lead Schema
// ============================================================

export const leadSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be at most 200 characters"),
  contactId: z.string().min(1, "Contact is required"),
  source: z.enum(leadSourceValues).default("WEBSITE"),
  eventType: z
    .string()
    .max(100, "Event type must be at most 100 characters")
    .optional()
    .or(z.literal("")),
  eventDate: z.coerce
    .date()
    .refine(
      (d) => {
        // Event date can't be in the past — compare on the calendar day in the
        // server's TZ so "today" is always valid regardless of time-of-day (S-5/S-6).
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return d.getTime() >= today.getTime();
      },
      { message: "Event date cannot be in the past." }
    )
    .optional()
    .nullable(),
  guestCount: z
    .number()
    .int("Guest count must be a whole number")
    .min(1, "Guest count must be at least 1")
    .optional()
    .nullable(),
  estimatedValue: z
    .number()
    .min(0, "Estimated value cannot be negative")
    .optional()
    .nullable(),
  // Venue-specific inquiry fields (spec §3.1)
  preferredVenueId: z.string().optional().or(z.literal("")),
  assignedToId: z.string().optional().or(z.literal("")),
  slot: z.enum(["Lunch", "Dinner"]).optional().or(z.literal("")),
  // Preferred food option (kept as a string so existing values never break).
  vegNonVeg: z.string().max(50).optional().or(z.literal("")),
  perPlateBudget: z
    .number()
    .positive("Per-plate budget must be positive")
    .optional()
    .nullable(),
  description: z
    .string()
    .max(5000, "Description must be at most 5000 characters")
    .optional()
    .or(z.literal("")),
});

export type LeadInput = z.infer<typeof leadSchema>;
