import { z } from "zod";

// ============================================================
// Channel ROI Reallocator — shared Zod + TS types.
// ------------------------------------------------------------
// Kept OUT of the "use server" action file (which may export only async
// fns) and OUT of the pure engine, so the action, the cron route and the
// client panel can all import these without "use server" restrictions.
// Mirrors the placement convention of attribution.schema.ts.
// ============================================================

// Input range for a reallocation plan. `from`/`to` are ISO date strings
// (same shape as AttributionRangeParams); segmentByEventType opts the plan
// into per-(channel, Lead.eventType) buckets (e.g. "weddings").
export const reallocationRangeSchema = z.object({
  from: z.string().trim().max(40).optional(),
  to: z.string().trim().max(40).optional(),
  segmentByEventType: z.boolean().optional(),
});

export type ReallocationRangeParams = z.infer<typeof reallocationRangeSchema>;

// ============================================================
// View models returned to the client (Decimal → Number at the boundary).
// ============================================================

export interface ReallocationRecView {
  id: string;
  fromChannel: string;
  toChannel: string;
  segment: string | null;
  shiftAmount: number; // rupees to move
  currency: string;
  expectedBookingDelta: number; // "+3 bookings"
  rationale: string | null;
}

export interface ReallocationRunView {
  id: string;
  periodStart: string; // ISO
  periodEnd: string; // ISO
  totalSpend: number;
  currency: string;
  projectedBookingLift: number;
  projectedRoasLift: number;
  notes: string | null;
  createdAt: string; // ISO — "as of" timestamp shown on the panel
  recommendations: ReallocationRecView[];
}
