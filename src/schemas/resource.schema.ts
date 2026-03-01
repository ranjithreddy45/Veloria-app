import { z } from "zod";

// ============================================================
// Resource Type Enum Values (matching Prisma ResourceType enum)
// ============================================================

const resourceTypeValues = [
  "STAFF",
  "EQUIPMENT",
  "VEHICLE",
  "VENUE_ADDON",
  "OTHER",
] as const;

// ============================================================
// Resource Create/Update Schema
// ============================================================

export const resourceSchema = z.object({
  name: z
    .string()
    .min(1, "Resource name is required")
    .max(200, "Resource name must be at most 200 characters"),
  type: z.enum(resourceTypeValues, {
    error: "Resource type is required",
  }),
  description: z
    .string()
    .max(2000, "Description must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
  hourlyRate: z
    .number({ error: "Hourly rate must be a number" })
    .positive("Hourly rate must be positive")
    .optional()
    .or(z.literal(0).transform(() => undefined)),
  isAvailable: z.boolean().optional().default(true),
});

export type ResourceInput = z.infer<typeof resourceSchema>;

// ============================================================
// Resource Allocation Schema
// ============================================================

export const allocationSchema = z.object({
  resourceId: z.string().min(1, "Resource is required"),
  bookingId: z.string().min(1, "Booking is required"),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  notes: z
    .string()
    .max(2000, "Notes must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
});

export type AllocationInput = z.infer<typeof allocationSchema>;
