import { z } from "zod";

// ============================================================
// Venue Group Schema (Parent-Child Hierarchy)
// ============================================================

export const venueGroupSchema = z.object({
  parentVenueId: z.string().min(1, { error: "Parent venue is required" }),
  childVenueIds: z
    .array(z.string())
    .min(1, { error: "Select at least one child venue" }),
});

// ============================================================
// Multi-Venue Booking Schema
// ============================================================

export const multiVenueBookingSchema = z.object({
  venueGroupId: z.string().optional(),
  venueIds: z
    .array(z.string())
    .min(2, { error: "Select at least 2 venues" }),
});

// ============================================================
// Set Venue Parent Schema
// ============================================================

export const setVenueParentSchema = z.object({
  venueId: z.string().min(1, { error: "Venue is required" }),
  parentVenueId: z.string().nullable(),
});

// ============================================================
// Coordinated Schedule Schema
// ============================================================

export const coordinatedScheduleSchema = z.object({
  venueIds: z
    .array(z.string())
    .min(1, { error: "Select at least one venue" }),
  date: z.coerce.date({ error: "Date is required" }),
});

// ============================================================
// Inferred Types
// ============================================================

export type VenueGroupInput = z.infer<typeof venueGroupSchema>;
export type MultiVenueBookingInput = z.infer<typeof multiVenueBookingSchema>;
export type SetVenueParentInput = z.infer<typeof setVenueParentSchema>;
export type CoordinatedScheduleInput = z.infer<typeof coordinatedScheduleSchema>;
