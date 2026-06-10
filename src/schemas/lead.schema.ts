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
    .optional()
    .nullable(),
  guestCount: z
    .number()
    .int("Guest count must be a whole number")
    .positive("Guest count must be positive")
    .optional()
    .nullable(),
  estimatedValue: z
    .number()
    .positive("Estimated value must be positive")
    .optional()
    .nullable(),
  description: z
    .string()
    .max(5000, "Description must be at most 5000 characters")
    .optional()
    .or(z.literal("")),
});

export type LeadInput = z.infer<typeof leadSchema>;
