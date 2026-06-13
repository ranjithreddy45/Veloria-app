// ============================================================
// Projects module — shared UI vocabulary (Phase 0 helpers).
// Maps readiness %, phase keys, and checklist statuses to a CONSISTENT set of
// Tailwind classes + tokens so every panel (stepper, readiness, ops audit,
// handover) reads the same. No hardcoded hex — tailwind palette + CSS tokens.
// Safe on client + server (pure).
// ============================================================

import type { Hue } from "@/components/shared/status-pill";

// ---- Readiness health bands: red <30, amber 30–70, green >70 ----
export type HealthBand = "low" | "mid" | "high";

export function healthBand(pct: number): HealthBand {
  if (pct < 30) return "low";
  if (pct <= 70) return "mid";
  return "high";
}

export function healthHue(pct: number): Hue {
  const b = healthBand(pct);
  return b === "low" ? "rose" : b === "mid" ? "amber" : "emerald";
}

// Stroke color (currentColor-driven) for the Donut + bars, by band.
export function healthTextClass(pct: number): string {
  const b = healthBand(pct);
  return b === "low" ? "text-rose-500" : b === "mid" ? "text-amber-500" : "text-emerald-500";
}

export function healthBarClass(pct: number): string {
  const b = healthBand(pct);
  return b === "low" ? "bg-rose-500" : b === "mid" ? "bg-amber-500" : "bg-emerald-500";
}

// ---- 9-phase palette (token-colored pills with a status dot) ----
// Keyed by canonical phase key from lib/projects/phases.ts.
export const PHASE_HUE: Record<string, Hue> = {
  HANDOFF: "slate",
  ASSESSMENT: "blue",
  CAPEX: "violet",
  EXECUTION: "amber",
  INTERNAL_QC: "amber",
  OPS_AUDIT: "blue",
  FINAL_GO_AHEAD: "violet",
  HANDOVER: "teal",
  LIVE: "emerald",
};

export function phaseHue(phaseKey: string): Hue {
  return PHASE_HUE[phaseKey] ?? "slate";
}

// ---- Readiness checklist status vocabulary ----
// The stored statuses are PENDING / IN_PROGRESS / DONE / NA. For the segmented
// control we present three pills (Done / Pending / N/A); IN_PROGRESS reads as
// Pending (not yet signed off) and writing "Pending" stores PENDING.
export type ChecklistTone = "done" | "pending" | "na";

export function readinessTone(status: string): ChecklistTone {
  if (status === "DONE") return "done";
  if (status === "NA") return "na";
  return "pending"; // PENDING + IN_PROGRESS
}

// Ops-audit statuses are PENDING / PASS / FAIL / NA. PASS→done, FAIL→pending
// tone (needs attention, accented), NA→na.
export function auditTone(status: string): ChecklistTone {
  if (status === "PASS") return "done";
  if (status === "NA") return "na";
  return "pending"; // PENDING + FAIL
}

// Counts a list of items by tone, using the supplied tone resolver.
export function countByTone<T extends { status: string }>(
  items: T[],
  toneOf: (s: string) => ChecklistTone,
): { done: number; pending: number; na: number; total: number; pct: number } {
  let done = 0, pending = 0, na = 0;
  for (const it of items) {
    const t = toneOf(it.status);
    if (t === "done") done++;
    else if (t === "na") na++;
    else pending++;
  }
  const total = items.length;
  // % ready = (done + N/A) / total — N/A items are "satisfied" (not blocking).
  const pct = total ? Math.round(((done + na) / total) * 100) : 0;
  return { done, pending, na, total, pct };
}
