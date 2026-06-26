import { z } from "zod";

// ============================================================
// Package Tier Enum Values (matching Prisma PackageTier)
// ============================================================

const packageTierValues = ["BASIC", "STANDARD", "PREMIUM", "CUSTOM"] as const;

// ============================================================
// Package Item Schema
// ============================================================

export const packageItemSchema = z.object({
  id: z.string().optional(),
  name: z
    .string()
    .min(1, "Item name is required")
    .max(200, "Item name must be at most 200 characters"),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional()
    .or(z.literal("")),
  category: z
    .string()
    .max(100, "Category must be at most 100 characters")
    .optional()
    .or(z.literal("")),
  quantity: z
    .number({ message: "Quantity must be a number" })
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1"),
  unitPrice: z
    .number({ message: "Unit price must be a number" })
    .min(0, "Unit price must be positive"),
  isIncluded: z.boolean().default(true),
  order: z.number().int().default(0),
});

export type PackageItemInput = z.infer<typeof packageItemSchema>;

// ============================================================
// Event Package Schema
// ============================================================

export const packageSchema = z.object({
  name: z
    .string()
    .min(1, "Package name is required")
    .max(200, "Package name must be at most 200 characters"),
  description: z
    .string()
    .max(2000, "Description must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
  eventType: z
    .string()
    .max(100, "Event type must be at most 100 characters")
    .optional()
    .or(z.literal("")),
  basePrice: z
    .number({ message: "Base price must be a number" })
    .min(0, "Base price must be non-negative"),
  tier: z.enum(packageTierValues, {
    message: "Tier is required",
  }),
  isActive: z.boolean().default(true),
  imageUrl: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
  items: z
    .array(packageItemSchema)
    .max(100, "Package cannot have more than 100 items")
    .default([]),
});

export type PackageInput = z.infer<typeof packageSchema>;
