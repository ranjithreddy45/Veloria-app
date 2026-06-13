// ============================================================
// Velos point-value defaults (B2). Seeded into VelosConfig so they
// are tunable without a redeploy — code reads the DB, not these
// constants, at award time. These are only the initial values.
// ============================================================

export interface VelosEventDef {
  eventType: string;
  points: number;
  label: string;
  category: "pipeline" | "lead_sla" | "ops" | "finance" | "peer" | "recovery";
  clawbackEligible?: boolean;
  isEffort?: boolean;
}

export const VELOS_DEFAULTS: VelosEventDef[] = [
  // Pipeline stage advances (entityType 'deal') — once per deal per stage.
  { eventType: "contacted", points: 5, label: "Lead contacted", category: "pipeline" },
  { eventType: "site_visit_scheduled", points: 15, label: "Site visit scheduled", category: "pipeline" },
  { eventType: "site_visit_done", points: 25, label: "Site visit completed", category: "pipeline", isEffort: true },
  { eventType: "quote_sent", points: 20, label: "Quote sent", category: "pipeline" },
  { eventType: "tentative_hold", points: 30, label: "Tentative hold", category: "pipeline" },
  { eventType: "token_paid", points: 60, label: "Token paid", category: "pipeline", clawbackEligible: true },
  { eventType: "contract_signed", points: 100, label: "Contract signed", category: "pipeline", clawbackEligible: true },
  { eventType: "advance_received", points: 80, label: "Advance received", category: "pipeline", clawbackEligible: true },
  { eventType: "event_executed", points: 120, label: "Event executed", category: "pipeline" },

  // Lead SLA (entityType 'lead') — the speed engine. Ships WITH the quality gate (A5).
  { eventType: "contact_logged_before_sla", points: 20, label: "Contacted within SLA", category: "lead_sla" },
  { eventType: "contact_logged_within_15min", points: 10, label: "Contacted within 15 min (bonus)", category: "lead_sla" },
  { eventType: "lead_went_overdue", points: -10, label: "Lead went overdue", category: "lead_sla" },
  { eventType: "end_of_day_zero_overdue", points: 5, label: "Zero overdue leads (daily)", category: "lead_sla" },

  // Operations tasks (entityType 'task').
  { eventType: "task_done_on_time_high", points: 20, label: "High-priority task on time", category: "ops" },
  { eventType: "task_done_on_time_medium", points: 12, label: "Medium-priority task on time", category: "ops" },
  { eventType: "task_done_on_time_low", points: 6, label: "Low-priority task on time", category: "ops" },
  { eventType: "event_closed_no_overdue_tasks", points: 40, label: "Clean execution (no overdue tasks)", category: "ops" },

  // Finance (entityType 'payment').
  { eventType: "payment_collected_on_or_before_due", points: 25, label: "Payment collected on time", category: "finance" },

  // Peer & recovery.
  { eventType: "kudos_received", points: 10, label: "Kudos received", category: "peer" },
  { eventType: "assist_credit", points: 0, label: "Assist credit (25% of close)", category: "peer" },
  { eventType: "slump_quest_completed", points: 30, label: "Recovery quest completed", category: "recovery" },
  { eventType: "quest_reward", points: 0, label: "Quest reward", category: "recovery" },
];

// Anti-collusion + slump config (also overridable later via a settings row if needed).
export const VELOS_TUNING = {
  KUDOS_MAX_PER_GIVER_PER_WEEK: 3,
  ASSIST_SHARE: 0.25, // 25% of the close points
  SLUMP_THRESHOLD: 0.4, // last-7-days < baseline * this
  SLUMP_DAYS: 10, // OR days since last positive close
  SLUMP_BASELINE_WEEKS: 8,
};

// Identity arc (A2) — lifetime-Velos ladder with named stages + real unlocks.
// Mirrors the Bronze→Platinum loyalty ladder; ops gets a parallel track.
export interface VelosTier {
  key: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
  minLifetime: number;
  salesIdentity: string;
  opsIdentity: string;
  unlock: string;
  hue: "amber" | "slate" | "violet" | "emerald";
}

export const VELOS_TIERS: VelosTier[] = [
  { key: "BRONZE", minLifetime: 0, salesIdentity: "Prospector", opsIdentity: "Coordinator", unlock: "Standard lead flow", hue: "amber" },
  { key: "SILVER", minLifetime: 500, salesIdentity: "Closer", opsIdentity: "Steward", unlock: "Priority lead routing · choose your weekly quest", hue: "slate" },
  { key: "GOLD", minLifetime: 1500, salesIdentity: "Master Closer", opsIdentity: "Maestro", unlock: "First pick of high-value enquiries · mentor credit", hue: "amber" },
  { key: "PLATINUM", minLifetime: 3500, salesIdentity: "Rainmaker", opsIdentity: "Maestro", unlock: "Best territory · input on team decisions · quarterly award", hue: "violet" },
];

export function tierForLifetime(lifetime: number): { tier: VelosTier; next: VelosTier | null; toNext: number; pctToNext: number } {
  let idx = 0;
  for (let i = 0; i < VELOS_TIERS.length; i++) if (lifetime >= VELOS_TIERS[i].minLifetime) idx = i;
  const tier = VELOS_TIERS[idx];
  const next = VELOS_TIERS[idx + 1] ?? null;
  const toNext = next ? Math.max(0, next.minLifetime - lifetime) : 0;
  const span = next ? next.minLifetime - tier.minLifetime : 1;
  const pctToNext = next ? Math.min(100, Math.round(((lifetime - tier.minLifetime) / span) * 100)) : 100;
  return { tier, next, toNext, pctToNext };
}

/** Period key 'YYYY-MM' for a date (UTC). */
export function velosPeriod(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentPeriod(): string {
  return velosPeriod(new Date());
}
