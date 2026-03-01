import { z } from "zod";

// ============================================================
// Menu Categories, Cuisines & Dietary Tags (matching constants)
// ============================================================

const menuCategoryValues = [
  "Starters",
  "Main Course",
  "Desserts",
  "Beverages",
  "Live Counters",
  "Salads",
  "Breads",
  "Rice & Biryani",
  "Accompaniments",
] as const;

const menuCuisineValues = [
  "North Indian",
  "South Indian",
  "Chinese",
  "Italian",
  "Continental",
  "Mughlai",
  "Street Food",
  "Pan Asian",
] as const;

const dietaryTagValues = [
  "Vegetarian",
  "Vegan",
  "Non-Vegetarian",
  "Gluten Free",
  "Jain",
  "Sugar Free",
] as const;

// ============================================================
// Menu Item Create/Update Schema
// ============================================================

export const menuItemSchema = z.object({
  name: z
    .string()
    .min(1, "Item name is required")
    .max(200, "Item name must be at most 200 characters"),
  description: z
    .string()
    .max(2000, "Description must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
  category: z.enum(menuCategoryValues, {
    error: "Category is required",
  }),
  cuisine: z
    .enum(menuCuisineValues, {
      error: "Invalid cuisine",
    })
    .optional()
    .or(z.literal("")),
  dietaryTags: z.array(z.enum(dietaryTagValues)).optional().default([]),
  pricePerHead: z
    .number({ error: "Price per head must be a number" })
    .positive("Price per head must be positive"),
  imageUrl: z
    .string()
    .url("Invalid URL")
    .optional()
    .or(z.literal("")),
  isActive: z.boolean().optional().default(true),
});

export type MenuItemInput = z.infer<typeof menuItemSchema>;

// ============================================================
// Booking Menu Selection Schema
// ============================================================

export const bookingMenuSelectionSchema = z.object({
  menuItemId: z.string().min(1, "Menu item is required"),
  quantity: z
    .number({ error: "Quantity must be a number" })
    .int("Quantity must be a whole number")
    .positive("Quantity must be positive"),
  customPrice: z
    .number({ error: "Custom price must be a number" })
    .positive("Custom price must be positive")
    .optional(),
});

export type BookingMenuSelectionInput = z.infer<typeof bookingMenuSelectionSchema>;

// ============================================================
// Save Booking Menu Schema
// ============================================================

export const saveBookingMenuSchema = z.object({
  guestCount: z
    .number({ error: "Guest count must be a number" })
    .int("Guest count must be a whole number")
    .positive("Guest count must be at least 1"),
  pricePerHead: z
    .number({ error: "Price per head must be a number" })
    .min(0, "Price per head cannot be negative"),
  specialInstructions: z
    .string()
    .max(5000, "Special instructions must be at most 5000 characters")
    .optional()
    .or(z.literal("")),
  selections: z
    .array(bookingMenuSelectionSchema)
    .min(1, "At least one menu item must be selected"),
});

export type SaveBookingMenuInput = z.infer<typeof saveBookingMenuSchema>;
