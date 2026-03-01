import { z } from "zod";

export const scoringRuleSchema = z.object({
  name: z.string().min(1, "Rule name is required").max(100),
  category: z.enum(["FIELD_BASED", "ACTIVITY_BASED", "PROFILE_COMPLETENESS", "DECAY"]),
  points: z.number().int(),
  conditions: z.array(z.record(z.string(), z.unknown())).default([]),
  isActive: z.boolean().default(true),
  order: z.number().int().default(0),
});

export const scoringRuleSetSchema = z.object({
  name: z.string().min(1, "Rule set name is required").max(100),
  entityType: z.enum(["LEAD", "CONTACT", "DEAL"]),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  maxScore: z.number().int().positive().default(100),
});

export type ScoringRuleInput = z.input<typeof scoringRuleSchema>;
export type ScoringRuleSetInput = z.input<typeof scoringRuleSetSchema>;
