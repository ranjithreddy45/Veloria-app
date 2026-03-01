import { z } from "zod";

// ============================================================
// Submit Review Schema (Client Portal)
// ============================================================

export const submitReviewSchema = z.object({
  bookingId: z.string().min(1, { error: "Please select a booking" }),
  rating: z
    .number({ error: "Rating is required" })
    .int("Rating must be a whole number")
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  title: z
    .string()
    .max(200, "Title must be at most 200 characters")
    .optional()
    .or(z.literal("")),
  content: z
    .string()
    .min(10, "Review must be at least 10 characters")
    .max(5000, "Review must be at most 5000 characters"),
  isPublic: z.boolean().optional().default(true),
});

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;

// ============================================================
// Respond to Review Schema (Dashboard Moderation)
// ============================================================

export const respondToReviewSchema = z.object({
  response: z
    .string()
    .min(1, "Response is required")
    .max(5000, "Response must be at most 5000 characters"),
});

export type RespondToReviewInput = z.infer<typeof respondToReviewSchema>;
