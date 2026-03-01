import { z } from "zod";

// ============================================================
// Operation Status & Staff Assignment Status Enum Values
// ============================================================

const operationStatusValues = [
  "PLANNING",
  "READY",
  "LIVE",
  "COMPLETED",
] as const;

const staffAssignmentStatusValues = [
  "ASSIGNED",
  "CONFIRMED",
  "CHECKED_IN",
] as const;

// ============================================================
// Create Operation Schema
// ============================================================

export const createOperationSchema = z.object({
  bookingId: z.string().min(1, { error: "Booking is required" }),
  status: z.enum(operationStatusValues).optional().default("PLANNING"),
  internalNotes: z
    .string()
    .max(5000, "Internal notes must be at most 5000 characters")
    .optional()
    .or(z.literal("")),
});

export type CreateOperationInput = z.input<typeof createOperationSchema>;

// ============================================================
// Update Operation Schema
// ============================================================

export const updateOperationSchema = z.object({
  status: z.enum(operationStatusValues).optional(),
  internalNotes: z
    .string()
    .max(5000, "Internal notes must be at most 5000 characters")
    .optional()
    .or(z.literal("")),
});

export type UpdateOperationInput = z.infer<typeof updateOperationSchema>;

// ============================================================
// Run of Show Item Schema
// ============================================================

export const runOfShowItemSchema = z.object({
  time: z.string().min(1, { error: "Time is required" }),
  activity: z.string().min(1, { error: "Activity is required" }),
  notes: z
    .string()
    .max(500, "Notes must be at most 500 characters")
    .optional()
    .or(z.literal("")),
  assignee: z
    .string()
    .max(200, "Assignee must be at most 200 characters")
    .optional()
    .or(z.literal("")),
});

export const updateRunOfShowSchema = z.object({
  items: z.array(runOfShowItemSchema),
});

export type RunOfShowItem = z.infer<typeof runOfShowItemSchema>;
export type UpdateRunOfShowInput = z.infer<typeof updateRunOfShowSchema>;

// ============================================================
// Staff Assignment Schema
// ============================================================

export const assignStaffSchema = z.object({
  userId: z.string().min(1, { error: "Staff member is required" }),
  role: z
    .string()
    .min(1, { error: "Role is required" })
    .max(200, "Role must be at most 200 characters"),
  shiftStart: z.coerce.date({ error: "Shift start time is required" }),
  shiftEnd: z.coerce.date({ error: "Shift end time is required" }),
  notes: z
    .string()
    .max(1000, "Notes must be at most 1000 characters")
    .optional()
    .or(z.literal("")),
});

export type AssignStaffInput = z.infer<typeof assignStaffSchema>;

// ============================================================
// Update Staff Assignment Status Schema
// ============================================================

export const updateStaffStatusSchema = z.object({
  status: z.enum(staffAssignmentStatusValues, {
    error: "Invalid status",
  }),
});

export type UpdateStaffStatusInput = z.infer<typeof updateStaffStatusSchema>;

// ============================================================
// Vendor Assignment Schema
// ============================================================

export const assignOperationVendorSchema = z.object({
  bookingVendorId: z.string().min(1, { error: "Vendor is required" }),
  arrivalTime: z
    .string()
    .max(100, "Arrival time must be at most 100 characters")
    .optional()
    .or(z.literal("")),
  setupTime: z
    .string()
    .max(100, "Setup time must be at most 100 characters")
    .optional()
    .or(z.literal("")),
  teardownTime: z
    .string()
    .max(100, "Teardown time must be at most 100 characters")
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .max(1000, "Notes must be at most 1000 characters")
    .optional()
    .or(z.literal("")),
});

export type AssignOperationVendorInput = z.infer<typeof assignOperationVendorSchema>;
