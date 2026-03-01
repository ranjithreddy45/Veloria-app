import { z } from "zod";

// ============================================================
// Time Slot Enum Values (matching Prisma TimeSlot)
// ============================================================

const timeSlotValues = [
  "MORNING",
  "AFTERNOON",
  "EVENING",
  "FULL_DAY",
] as const;

// ============================================================
// Booking Schema
// ============================================================

export const bookingSchema = z.object({
  eventName: z
    .string()
    .min(1, "Event name is required")
    .max(200, "Event name must be at most 200 characters"),
  eventType: z
    .string()
    .min(1, "Event type is required")
    .max(100, "Event type must be at most 100 characters"),
  venueId: z.string().min(1, "Venue is required"),
  contactId: z.string().min(1, "Contact is required"),
  date: z.coerce.date({
    error: "Booking date is required",
  }),
  timeSlot: z.enum(timeSlotValues, {
    error: "Time slot is required",
  }),
  guestCount: z
    .number({
      error: "Guest count must be a number",
    })
    .int("Guest count must be a whole number")
    .positive("Guest count must be positive"),
  totalAmount: z
    .number({
      error: "Total amount must be a number",
    })
    .positive("Total amount must be positive"),
  specialRequests: z
    .string()
    .max(2000, "Special requests must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
  internalNotes: z
    .string()
    .max(2000, "Internal notes must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
});

export type BookingInput = z.infer<typeof bookingSchema>;
