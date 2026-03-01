import { z } from "zod";
import { INVENTORY_CATEGORIES } from "@/lib/constants";

// ============================================================
// Reservation Status Enum Values (matching Prisma enum)
// ============================================================

const reservationStatusValues = [
  "RESERVED",
  "IN_USE",
  "RETURNED",
  "DAMAGED",
] as const;

// ============================================================
// Inventory Item Create/Update Schema
// ============================================================

export const inventoryItemSchema = z.object({
  name: z
    .string()
    .min(1, "Item name is required")
    .max(200, "Item name must be at most 200 characters"),
  sku: z
    .string()
    .max(50, "SKU must be at most 50 characters")
    .optional()
    .or(z.literal("")),
  category: z.enum(
    INVENTORY_CATEGORIES as unknown as [string, ...string[]],
    { error: "Category is required" }
  ),
  description: z
    .string()
    .max(2000, "Description must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
  totalQuantity: z
    .number({ error: "Total quantity must be a number" })
    .int("Total quantity must be a whole number")
    .min(0, "Total quantity cannot be negative"),
  availableQty: z
    .number({ error: "Available quantity must be a number" })
    .int("Available quantity must be a whole number")
    .min(0, "Available quantity cannot be negative"),
  reorderLevel: z
    .number({ error: "Reorder level must be a number" })
    .int("Reorder level must be a whole number")
    .min(0, "Reorder level cannot be negative")
    .optional()
    .default(5),
  unitCost: z
    .number({ error: "Unit cost must be a number" })
    .min(0, "Unit cost cannot be negative")
    .optional(),
  location: z
    .string()
    .max(200, "Location must be at most 200 characters")
    .optional()
    .or(z.literal("")),
  isActive: z.boolean().optional().default(true),
});

export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;

// ============================================================
// Inventory Reservation Schema
// ============================================================

export const inventoryReservationSchema = z.object({
  quantity: z
    .number({ error: "Quantity must be a number" })
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1"),
  date: z.coerce.date({ error: "Reservation date is required" }),
  returnDate: z.coerce.date().optional().nullable(),
  status: z.enum(reservationStatusValues).optional().default("RESERVED"),
  notes: z
    .string()
    .max(2000, "Notes must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
  itemId: z.string().min(1, "Item is required"),
  bookingId: z.string().min(1, "Booking is required"),
});

export type InventoryReservationInput = z.infer<typeof inventoryReservationSchema>;

// ============================================================
// Release Reservation Schema
// ============================================================

export const releaseReservationSchema = z.object({
  status: z.enum(["RETURNED", "DAMAGED"], {
    error: "Status must be RETURNED or DAMAGED",
  }),
  notes: z
    .string()
    .max(2000, "Notes must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
});

export type ReleaseReservationInput = z.infer<typeof releaseReservationSchema>;
