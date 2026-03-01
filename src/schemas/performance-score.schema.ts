import { z } from "zod";

export const calculateScoresSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, "Period must be YYYY-MM format"),
});

export type CalculateScoresInput = z.infer<typeof calculateScoresSchema>;

export const awardBadgeSchema = z.object({
  type: z.enum(["SPEED_STAR", "QUALITY_CHAMPION", "RELIABILITY_KING", "ZERO_ESCALATION", "TOP_PERFORMER", "MONTHLY_BEST"]),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional().or(z.literal("")),
  period: z.string().optional().or(z.literal("")),
  userId: z.string().optional().or(z.literal("")),
  vendorId: z.string().optional().or(z.literal("")),
});

export type AwardBadgeInput = z.infer<typeof awardBadgeSchema>;

export const createIncentiveSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  points: z.number().int().min(0).default(0),
  bonusAmount: z.number().min(0).optional().nullable(),
  period: z.string().regex(/^\d{4}-\d{2}$/, "Period must be YYYY-MM format"),
  userId: z.string().optional().or(z.literal("")),
  vendorId: z.string().optional().or(z.literal("")),
});

export type CreateIncentiveInput = z.infer<typeof createIncentiveSchema>;
