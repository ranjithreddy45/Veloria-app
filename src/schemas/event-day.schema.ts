import { z } from "zod";

// ============================================================
// Timeline Item Status Values (matching Prisma TimelineItemStatus)
// ============================================================

const timelineItemStatusValues = [
  "PENDING",
  "IN_PROGRESS",
  "DONE",
  "SKIPPED",
] as const;

// ============================================================
// Timeline Status Values (matching Prisma TimelineStatus)
// ============================================================

const timelineStatusValues = ["PLANNED", "LIVE", "COMPLETED"] as const;

// ============================================================
// Add Timeline Item Schema
// ============================================================

export const addTimelineItemSchema = z.object({
  time: z
    .string()
    .min(1, { error: "Time is required" })
    .max(20, { error: "Time must be at most 20 characters" }),
  activity: z
    .string()
    .min(1, { error: "Activity is required" })
    .max(500, { error: "Activity must be at most 500 characters" }),
  assigneeId: z.string().optional().or(z.literal("")),
  notes: z
    .string()
    .max(1000, { error: "Notes must be at most 1000 characters" })
    .optional()
    .or(z.literal("")),
});

export type AddTimelineItemInput = z.infer<typeof addTimelineItemSchema>;

// ============================================================
// Update Timeline Item Schema
// ============================================================

export const updateTimelineItemSchema = z.object({
  time: z
    .string()
    .min(1, { error: "Time is required" })
    .max(20, { error: "Time must be at most 20 characters" })
    .optional(),
  activity: z
    .string()
    .min(1, { error: "Activity is required" })
    .max(500, { error: "Activity must be at most 500 characters" })
    .optional(),
  assigneeId: z.string().optional().or(z.literal("")),
  notes: z
    .string()
    .max(1000, { error: "Notes must be at most 1000 characters" })
    .optional()
    .or(z.literal("")),
});

export type UpdateTimelineItemInput = z.infer<typeof updateTimelineItemSchema>;

// ============================================================
// Update Item Status Schema
// ============================================================

export const updateItemStatusSchema = z.object({
  status: z.enum(timelineItemStatusValues, {
    error: "Invalid timeline item status",
  }),
});

export type UpdateItemStatusInput = z.infer<typeof updateItemStatusSchema>;

// ============================================================
// Reorder Items Schema
// ============================================================

export const reorderItemsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1, { error: "Item ID is required" }),
        order: z.number().int({ error: "Order must be an integer" }),
      })
    )
    .min(1, { error: "At least one item is required" }),
});

export type ReorderItemsInput = z.infer<typeof reorderItemsSchema>;

// ============================================================
// Update Timeline Status Schema
// ============================================================

export const updateTimelineStatusSchema = z.object({
  status: z.enum(timelineStatusValues, {
    error: "Invalid timeline status",
  }),
});

export type UpdateTimelineStatusInput = z.infer<
  typeof updateTimelineStatusSchema
>;
