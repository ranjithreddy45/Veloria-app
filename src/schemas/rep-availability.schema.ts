import { z } from "zod";

// ============================================================
// Rep availability + routing-skill schemas
// ============================================================
// Validated at the top of every rep-availability action. Mirrors the
// Prisma RepAvailabilityStatus enum (ONLINE | BUSY | AWAY | OFFLINE).

export const repAvailabilityStatusSchema = z.enum([
  "ONLINE",
  "BUSY",
  "AWAY",
  "OFFLINE",
]);

export type RepAvailabilityStatusInput = z.infer<
  typeof repAvailabilityStatusSchema
>;

export const routingSkillsSchema = z.object({
  eventTypeSkills: z
    .array(z.string().min(1).max(60))
    .max(40)
    .default([]),
  languages: z.array(z.string().min(1).max(20)).max(40).default([]),
  capacityLimit: z.number().int().min(1).max(500).default(50),
});

export type RoutingSkillsInput = z.input<typeof routingSkillsSchema>;

// Admin override of another rep's row — every field optional (patch).
export const repAvailabilityPatchSchema = z.object({
  status: repAvailabilityStatusSchema.optional(),
  eventTypeSkills: z.array(z.string().min(1).max(60)).max(40).optional(),
  languages: z.array(z.string().min(1).max(20)).max(40).optional(),
  capacityLimit: z.number().int().min(1).max(500).optional(),
  autoOfflineAfterMin: z.number().int().min(1).max(1440).optional(),
});

export type RepAvailabilityPatchInput = z.infer<
  typeof repAvailabilityPatchSchema
>;
