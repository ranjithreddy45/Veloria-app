import { z } from "zod";

// ============================================================
// Rental Categories (matching constants)
// ============================================================

const rentalCategoryValues = [
  "Tent & Marquee",
  "Furniture",
  "Stage & Platform",
  "Lighting",
  "Sound System",
  "Generator",
  "Cooling/Heating",
  "Dance Floor",
  "Photo Booth",
  "Other",
] as const;

const rentalBookingStatusValues = [
  "RESERVED",
  "RENTED",
  "RETURNED",
  "OVERDUE",
] as const;

// ============================================================
// Rental Item Create/Update Schema
// ============================================================

export const rentalItemSchema = z.object({
  name: z
    .string()
    .min(1, "Item name is required")
    .max(200, "Item name must be at most 200 characters"),
  category: z.enum(rentalCategoryValues, {
    error: "Category is required",
  }),
  description: z
    .string()
    .max(2000, "Description must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
  dailyRate: z
    .number({ error: "Daily rate must be a number" })
    .positive("Daily rate must be positive"),
  weeklyRate: z
    .number({ error: "Weekly rate must be a number" })
    .positive("Weekly rate must be positive")
    .optional()
    .nullable(),
  quantity: z
    .number({ error: "Quantity must be a number" })
    .int("Quantity must be a whole number")
    .positive("Quantity must be at least 1"),
  availableQty: z
    .number({ error: "Available quantity must be a number" })
    .int("Available quantity must be a whole number")
    .min(0, "Available quantity cannot be negative"),
  condition: z
    .string()
    .max(200, "Condition must be at most 200 characters")
    .optional()
    .or(z.literal("")),
  imageUrl: z
    .string()
    .url("Invalid URL")
    .optional()
    .or(z.literal("")),
});

export type RentalItemInput = z.infer<typeof rentalItemSchema>;

// ============================================================
// Rent Item Schema (Create a Rental Booking)
// ============================================================

export const rentItemSchema = z.object({
  rentalItemId: z.string().min(1, "Rental item is required"),
  bookingId: z.string().min(1, "Booking is required"),
  quantity: z
    .number({ error: "Quantity must be a number" })
    .int("Quantity must be a whole number")
    .positive("Quantity must be at least 1"),
  startDate: z.coerce.date({ error: "Start date is required" }),
  endDate: z.coerce.date({ error: "End date is required" }),
});

export type RentItemInput = z.infer<typeof rentItemSchema>;

// ============================================================
// Return Item Schema
// ============================================================

export const returnItemSchema = z.object({
  rentalBookingId: z.string().min(1, "Rental booking ID is required"),
});

export type ReturnItemInput = z.infer<typeof returnItemSchema>;

// ============================================================
// Availability Check Schema
// ============================================================

export const availabilityCheckSchema = z.object({
  rentalItemId: z.string().min(1, "Rental item is required"),
  startDate: z.coerce.date({ error: "Start date is required" }),
  endDate: z.coerce.date({ error: "End date is required" }),
});

export type AvailabilityCheckInput = z.infer<typeof availabilityCheckSchema>;

// ============================================================
// Rental Cost Calculation Schema
// ============================================================

export const rentalCostSchema = z.object({
  rentalItemId: z.string().min(1, "Rental item is required"),
  quantity: z
    .number({ error: "Quantity must be a number" })
    .int("Quantity must be a whole number")
    .positive("Quantity must be at least 1"),
  startDate: z.coerce.date({ error: "Start date is required" }),
  endDate: z.coerce.date({ error: "End date is required" }),
});

export type RentalCostInput = z.infer<typeof rentalCostSchema>;

export { rentalCategoryValues, rentalBookingStatusValues };
