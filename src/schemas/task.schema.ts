import { z } from "zod";

// ============================================================
// Task Priority Enum Values (matching Prisma TaskPriority)
// ============================================================

const taskPriorityValues = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

// ============================================================
// Task Schema
// ============================================================

export const taskSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be at most 200 characters"),
  description: z
    .string()
    .max(5000, "Description must be at most 5000 characters")
    .optional()
    .or(z.literal("")),
  priority: z.enum(taskPriorityValues).default("MEDIUM"),
  dueDate: z.coerce
    .date()
    .optional()
    .nullable(),
  assigneeId: z
    .string()
    .optional()
    .or(z.literal("")),
  bookingId: z
    .string()
    .optional()
    .or(z.literal("")),
});

export type TaskInput = z.infer<typeof taskSchema>;
