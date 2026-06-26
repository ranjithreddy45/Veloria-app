import { z } from "zod";

// ============================================================
// Shift & Payroll Status Enum Values (matching Prisma)
// ============================================================

const shiftStatusValues = [
  "SCHEDULED",
  "CHECKED_IN",
  "COMPLETED",
  "ABSENT",
] as const;

const payrollStatusValues = [
  "DRAFT",
  "APPROVED",
  "PAID",
] as const;

// ============================================================
// Staff Profile Schema
// ============================================================

export const staffProfileSchema = z.object({
  department: z
    .string()
    .max(200, "Department must be at most 200 characters")
    .optional()
    .or(z.literal("")),
  designation: z
    .string()
    .max(200, "Designation must be at most 200 characters")
    .optional()
    .or(z.literal("")),
  hourlyRate: z
    .number({ error: "Hourly rate must be a number" })
    .nonnegative("Hourly rate must be non-negative")
    .optional()
    .or(z.literal(0)),
  monthlyRate: z
    .number({ error: "Monthly rate must be a number" })
    .nonnegative("Monthly rate must be non-negative")
    .optional()
    .or(z.literal(0)),
  bankDetails: z
    .object({
      bankName: z.string().optional().or(z.literal("")),
      accountNumber: z.string().optional().or(z.literal("")),
      ifscCode: z.string().optional().or(z.literal("")),
    })
    .optional(),
  emergencyContact: z
    .object({
      name: z.string().optional().or(z.literal("")),
      phone: z.string().optional().or(z.literal("")),
      relation: z.string().optional().or(z.literal("")),
    })
    .optional(),
});

export type StaffProfileInput = z.infer<typeof staffProfileSchema>;

// ============================================================
// Time-of-day validation (HH:MM, 24-hour)
// ============================================================

// Matches 00:00 .. 23:59. Mirrors the format produced by the client-side
// <input type="time"> control and required by the shift-hours calculation,
// which splits on ":" and reads hours/minutes as numbers.
const timeOfDayRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const timeOfDayError = "Time must be in HH:MM (24-hour) format";

// ============================================================
// Create Shift Schema
// ============================================================

export const createShiftSchema = z.object({
  staffId: z.string().min(1, { error: "Staff member is required" }),
  date: z.coerce.date({ error: "Shift date is required" }),
  startTime: z
    .string()
    .min(1, { error: "Start time is required" })
    .regex(timeOfDayRegex, { error: timeOfDayError }),
  endTime: z
    .string()
    .min(1, { error: "End time is required" })
    .regex(timeOfDayRegex, { error: timeOfDayError }),
  role: z
    .string()
    .min(1, { error: "Role is required" })
    .max(200, "Role must be at most 200 characters"),
  bookingId: z.string().optional().or(z.literal("")),
});

export type CreateShiftInput = z.infer<typeof createShiftSchema>;

// ============================================================
// Update Shift Schema
// ============================================================

export const updateShiftSchema = z.object({
  date: z.coerce.date({ error: "Shift date is required" }).optional(),
  startTime: z
    .string()
    .min(1, { error: "Start time is required" })
    .regex(timeOfDayRegex, { error: timeOfDayError })
    .optional(),
  endTime: z
    .string()
    .min(1, { error: "End time is required" })
    .regex(timeOfDayRegex, { error: timeOfDayError })
    .optional(),
  role: z
    .string()
    .min(1, { error: "Role is required" })
    .max(200, "Role must be at most 200 characters")
    .optional(),
  status: z.enum(shiftStatusValues, { error: "Invalid shift status" }).optional(),
  hoursWorked: z
    .number({ error: "Hours worked must be a number" })
    .nonnegative("Hours worked must be non-negative")
    .optional(),
  overtimeHours: z
    .number({ error: "Overtime hours must be a number" })
    .nonnegative("Overtime hours must be non-negative")
    .optional(),
  bookingId: z.string().optional().or(z.literal("")),
});

export type UpdateShiftInput = z.infer<typeof updateShiftSchema>;

// ============================================================
// Generate Payroll Schema
// ============================================================

export const generatePayrollSchema = z.object({
  month: z
    .string()
    .min(1, { error: "Month is required" })
    .regex(/^\d{4}-\d{2}$/, { error: "Month must be in YYYY-MM format" }),
});

export type GeneratePayrollInput = z.infer<typeof generatePayrollSchema>;

// ============================================================
// Export enums for use elsewhere
// ============================================================

export { shiftStatusValues, payrollStatusValues };
