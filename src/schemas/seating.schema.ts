import { z } from "zod";

// ============================================================
// Table Shape Enum Values (matching Prisma enum)
// ============================================================

const tableShapeValues = ["ROUND", "RECTANGULAR", "LONG"] as const;

// ============================================================
// Create / Update Seating Chart Schema
// ============================================================

export const createChartSchema = z.object({
  name: z
    .string()
    .min(1, "Chart name is required")
    .max(200, "Chart name must be at most 200 characters"),
  rows: z
    .number({ error: "Rows must be a number" })
    .int("Rows must be a whole number")
    .min(1, "At least 1 row is required")
    .max(50, "Rows must be at most 50"),
  columns: z
    .number({ error: "Columns must be a number" })
    .int("Columns must be a whole number")
    .min(1, "At least 1 column is required")
    .max(50, "Columns must be at most 50"),
});

export type CreateChartInput = z.infer<typeof createChartSchema>;

export const updateChartSchema = z.object({
  name: z
    .string()
    .min(1, "Chart name is required")
    .max(200, "Chart name must be at most 200 characters")
    .optional(),
  rows: z
    .number({ error: "Rows must be a number" })
    .int("Rows must be a whole number")
    .min(1, "At least 1 row is required")
    .max(50, "Rows must be at most 50")
    .optional(),
  columns: z
    .number({ error: "Columns must be a number" })
    .int("Columns must be a whole number")
    .min(1, "At least 1 column is required")
    .max(50, "Columns must be at most 50")
    .optional(),
});

export type UpdateChartInput = z.infer<typeof updateChartSchema>;

// ============================================================
// Add / Update Table Schema
// ============================================================

export const addTableSchema = z.object({
  label: z
    .string()
    .min(1, "Table label is required")
    .max(100, "Table label must be at most 100 characters"),
  gridRow: z
    .number({ error: "Row position must be a number" })
    .int("Row must be a whole number")
    .min(1, "Row must be at least 1"),
  gridCol: z
    .number({ error: "Column position must be a number" })
    .int("Column must be a whole number")
    .min(1, "Column must be at least 1"),
  capacity: z
    .number({ error: "Capacity must be a number" })
    .int("Capacity must be a whole number")
    .min(1, "Capacity must be at least 1")
    .max(100, "Capacity must be at most 100"),
  shape: z.enum(tableShapeValues, {
    error: "Table shape is required",
  }),
  notes: z
    .string()
    .max(500, "Notes must be at most 500 characters")
    .optional()
    .or(z.literal("")),
});

export type AddTableInput = z.infer<typeof addTableSchema>;

export const updateTableSchema = z.object({
  label: z
    .string()
    .min(1, "Table label is required")
    .max(100, "Table label must be at most 100 characters")
    .optional(),
  gridRow: z
    .number({ error: "Row position must be a number" })
    .int("Row must be a whole number")
    .min(1, "Row must be at least 1")
    .optional(),
  gridCol: z
    .number({ error: "Column position must be a number" })
    .int("Column must be a whole number")
    .min(1, "Column must be at least 1")
    .optional(),
  capacity: z
    .number({ error: "Capacity must be a number" })
    .int("Capacity must be a whole number")
    .min(1, "Capacity must be at least 1")
    .max(100, "Capacity must be at most 100")
    .optional(),
  shape: z
    .enum(tableShapeValues, {
      error: "Table shape is required",
    })
    .optional(),
  notes: z
    .string()
    .max(500, "Notes must be at most 500 characters")
    .optional()
    .or(z.literal("")),
});

export type UpdateTableInput = z.infer<typeof updateTableSchema>;

// ============================================================
// Assign Guest Schema
// ============================================================

export const assignGuestSchema = z.object({
  name: z
    .string()
    .min(1, "Guest name is required")
    .max(200, "Guest name must be at most 200 characters"),
  category: z
    .string()
    .max(100, "Category must be at most 100 characters")
    .optional()
    .or(z.literal("")),
  seatNumber: z
    .number({ error: "Seat number must be a number" })
    .int("Seat number must be a whole number")
    .min(1, "Seat number must be at least 1")
    .optional(),
  notes: z
    .string()
    .max(500, "Notes must be at most 500 characters")
    .optional()
    .or(z.literal("")),
});

export type AssignGuestInput = z.infer<typeof assignGuestSchema>;
