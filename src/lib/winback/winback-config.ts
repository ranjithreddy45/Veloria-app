// ============================================================
// Win-back config — data-driven resolution of which ACTIVE Cadence backs
// each WinbackKind, plus per-lostReason cool-off windows and the
// event-proximity window. Pure config + tiny resolvers so behaviour is
// tunable and degrades gracefully when no cadence is configured (the engine
// then falls back to a direct-WhatsApp template).
//
// Plain library (NOT "use server"): import-only by the cron engine.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { WinbackKind } from "@prisma/client";

// ------------------------------------------------------------
// Stable cadence names — the ops team creates an ACTIVE, entityType=LEAD
// Cadence with one of these exact names to wire the recovery flow. When none
// exists for a kind, the engine fires the direct-WhatsApp fallback instead.
// ------------------------------------------------------------
export const WINBACK_CADENCE_NAMES: Record<WinbackKind, string> = {
  ABANDONED_QUOTE: "Win-back: Abandoned Quote",
  LOST_LEAD_REVIVAL: "Win-back: Lost Lead",
  EVENT_DATE_PROXIMITY: "Win-back: Event Proximity",
  COOLING_LEAD: "Cooling Lead Re-warm",
  CORPORATE_FARMING: "Win-back: Corporate Farming",
};

// Direct-WhatsApp fallback template per kind (must be an approved Meta template
// — see WHATSAPP_TEMPLATES). Used only when no matching ACTIVE cadence exists.
export const WINBACK_FALLBACK_TEMPLATE: Record<WinbackKind, string | null> = {
  ABANDONED_QUOTE: "winback_quote_followup",
  LOST_LEAD_REVIVAL: "winback_lost_lead",
  EVENT_DATE_PROXIMITY: "winback_event_proximity",
  COOLING_LEAD: null, // cooling-lead always goes through its cadence; no cold direct fire
  CORPORATE_FARMING: null,
};

// ------------------------------------------------------------
// Abandoned-quote recovery window
// ------------------------------------------------------------
// A QuoteShareLink that was viewed but never paid is eligible N days after the
// last view (gives the customer breathing room before the first nudge).
export const N_DAYS_ABANDONED = 2;

// ------------------------------------------------------------
// Lost-lead revival cool-off — measured from the lost timestamp (proxy:
// Lead.updatedAt at the LOST transition). Per-reason so price-sensitive leads
// are re-approached sooner than date-blocked ones. Stored as coolOffUntil on
// the WinbackTarget at first scan so eligibility is frozen.
// ------------------------------------------------------------
export const LOST_REASON_COOLOFF_DAYS: Record<string, number> = {
  PRICE: 45,
  TOO_EXPENSIVE: 45,
  BUDGET: 45,
  DATE_UNAVAILABLE: 30,
  DATE: 30,
  NO_RESPONSE: 21,
  COMPETITOR: 60,
  WENT_ELSEWHERE: 60,
};
export const LOST_REASON_COOLOFF_DEFAULT_DAYS = 60;

/** Cool-off (in days) for a given lost reason, with a sensible default. */
export function coolOffDaysForLostReason(lostReason?: string | null): number {
  if (!lostReason) return LOST_REASON_COOLOFF_DEFAULT_DAYS;
  const key = lostReason.trim().toUpperCase().replace(/\s+/g, "_");
  return LOST_REASON_COOLOFF_DAYS[key] ?? LOST_REASON_COOLOFF_DEFAULT_DAYS;
}

// ------------------------------------------------------------
// Event-date-proximity window — re-approach an old open enquiry when its
// event date is now near-term (last-minute availability nudge).
// ------------------------------------------------------------
export const PROXIMITY_WINDOW_MIN_DAYS = 7;
export const PROXIMITY_WINDOW_MAX_DAYS = 21;

// ------------------------------------------------------------
// Cadence resolver
// ------------------------------------------------------------
export interface ResolvedCadence {
  id: string;
  firstStepDelayMs: number | null;
}

/**
 * Resolve the ACTIVE, entityType=LEAD Cadence backing a WinbackKind by its
 * stable name. Returns null when none is configured (caller then falls back to
 * a direct WhatsApp template). Includes the first step's delay so the engine
 * can compute nextExecuteAt exactly like autoEnrollLeadIntoCadences.
 */
export async function resolveWinbackCadence(
  kind: WinbackKind
): Promise<ResolvedCadence | null> {
  const name = WINBACK_CADENCE_NAMES[kind];
  if (!name) return null;
  try {
    const cadence = await prisma.cadence.findFirst({
      where: { name, status: "ACTIVE", entityType: "LEAD" },
      include: { steps: { orderBy: { order: "asc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
    });
    if (!cadence) return null;
    const firstStep = cadence.steps[0];
    const firstStepDelayMs = firstStep
      ? (firstStep.delayDays ?? 0) * 24 * 60 * 60 * 1000 +
        (firstStep.delayHours ?? 0) * 60 * 60 * 1000
      : null;
    return { id: cadence.id, firstStepDelayMs };
  } catch (e) {
    console.error("[resolveWinbackCadence] error:", e);
    return null;
  }
}
