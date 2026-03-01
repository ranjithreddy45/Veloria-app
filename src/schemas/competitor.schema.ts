import { z } from "zod";

// ============================================================
// Competitor Schema
// ============================================================

export const competitorSchema = z.object({
  name: z.string().min(1, { error: "Name is required" }),
  website: z.string().url({ error: "Invalid URL" }).optional().or(z.literal("")),
  location: z.string().optional(),
  venueTypes: z.array(z.string()).default([]),
  priceRange: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  strengths: z.string().optional(),
  weaknesses: z.string().optional(),
  notes: z.string().optional(),
});

export type CompetitorInput = z.infer<typeof competitorSchema>;
