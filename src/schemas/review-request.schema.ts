import { z } from "zod";

// ============================================================
// Reputation Flywheel — input schemas
// ------------------------------------------------------------
// Shared by the PUBLIC landing-page actions/components and the internal
// dashboard. Action files ("use server") may export only async functions, so
// all zod schemas + their inferred input types live here.
// ============================================================

export const gateRatingSchema = z.object({
  rating: z.coerce
    .number()
    .int("Rating must be a whole number")
    .min(1, "Please pick at least 1 star")
    .max(5, "Rating cannot exceed 5 stars"),
});

export type GateRatingInput = z.infer<typeof gateRatingSchema>;

export const privateFeedbackSchema = z.object({
  comment: z
    .string()
    .trim()
    .max(2000, "Please keep your note under 2000 characters"),
});

export type PrivateFeedbackInput = z.infer<typeof privateFeedbackSchema>;
