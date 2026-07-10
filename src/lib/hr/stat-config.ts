import { prisma } from "@/lib/prisma";
import { DEFAULT_STAT_CONFIG, type StatConfig } from "./payroll-calc";

// ============================================================
// Per-entity statutory configuration loader.
// ------------------------------------------------------------
// Payroll used to run entirely on the hardcoded DEFAULT_STAT_CONFIG constants,
// which cannot be filed against — PF/ESI ceilings and PT slabs change by year
// and by state. This resolves the persisted HrStatutoryConfig for a legal entity
// and merges it over the code defaults.
//
// FALLBACK IS DELIBERATE: when no row exists (or no entity is given) we return
// DEFAULT_STAT_CONFIG unchanged, so every existing payroll run keeps producing
// exactly the same numbers until an admin explicitly configures the entity.
// A missing config must never silently zero out a statutory deduction.
// ============================================================

const num = (v: unknown): number => Number(v);

/** Applicability toggles resolved alongside the numeric config. */
export interface StatApplicability {
  pf: boolean;
  esi: boolean;
  pt: boolean;
  tds: boolean;
  lwf: boolean;
}

export interface ResolvedStatConfig {
  cfg: StatConfig;
  applicable: StatApplicability;
  /** true when a persisted row backed this config (false = code defaults). */
  configured: boolean;
  ptSlabs: { fromSalary: number; toSalary: number | null; ptAmount: number; additionalAmount: number }[];
  lwf: { state: string | null; employee: number; employer: number; months: number[] };
}

const DEFAULT_APPLICABILITY: StatApplicability = { pf: true, esi: true, pt: true, tds: true, lwf: false };

/**
 * Resolve the statutory config for a legal entity. Returns code defaults when
 * the entity has no persisted configuration.
 */
export async function resolveStatConfig(legalEntityId?: string | null): Promise<ResolvedStatConfig> {
  if (!legalEntityId) {
    return {
      cfg: DEFAULT_STAT_CONFIG,
      applicable: DEFAULT_APPLICABILITY,
      configured: false,
      ptSlabs: [],
      lwf: { state: null, employee: 0, employer: 0, months: [] },
    };
  }

  const row = await prisma.hrStatutoryConfig.findUnique({
    where: { legalEntityId },
    include: { ptSlabs: { orderBy: { order: "asc" } } },
  });

  if (!row) {
    return {
      cfg: DEFAULT_STAT_CONFIG,
      applicable: DEFAULT_APPLICABILITY,
      configured: false,
      ptSlabs: [],
      lwf: { state: null, employee: 0, employer: 0, months: [] },
    };
  }

  // Merge over the defaults so any field we add later keeps a sane value even on
  // rows written before it existed. Tax slabs stay in code (they are FY-wide, not
  // per-entity) and are intentionally NOT overridden here.
  const cfg: StatConfig = {
    ...DEFAULT_STAT_CONFIG,
    pfRatePct: num(row.pfRatePct),
    pfWageCeiling: num(row.pfWageCeiling),
    pfOnFullBasic: row.pfOnFullBasic,
    employerPfRatePct: num(row.employerPfRatePct),
    epsApplicable: row.epsApplicable,
    epsRatePct: num(row.epsRatePct),
    epsWageCeiling: num(row.epsWageCeiling),
    edliRatePct: num(row.edliRatePct),
    edliWageCeiling: num(row.edliWageCeiling),
    pfAdminRatePct: num(row.pfAdminRatePct),
    esiRatePct: num(row.esiRatePct),
    employerEsiRatePct: num(row.employerEsiRatePct),
    esiGrossCeiling: num(row.esiGrossCeiling),
    ptAmount: num(row.ptAmount),
    ptGrossThreshold: num(row.ptGrossThreshold),
    gratuityDaysPerYear: row.gratuityDaysPerYear,
    gratuityMonthDivisor: row.gratuityMonthDivisor,
    gratuityMinYears: row.gratuityMinYears,
  };

  // An "off" toggle must actually stop the deduction. Zeroing the rate is the
  // safest way to express that without threading a flag through the pure engine.
  if (!row.pfApplicable) {
    cfg.pfRatePct = 0;
    cfg.employerPfRatePct = 0;
    cfg.epsRatePct = 0;
    cfg.edliRatePct = 0;
    cfg.pfAdminRatePct = 0;
  }
  if (!row.esiApplicable) {
    cfg.esiRatePct = 0;
    cfg.employerEsiRatePct = 0;
  }
  if (!row.ptApplicable) cfg.ptAmount = 0;

  return {
    cfg,
    applicable: {
      pf: row.pfApplicable,
      esi: row.esiApplicable,
      pt: row.ptApplicable,
      tds: row.tdsApplicable,
      lwf: row.lwfApplicable,
    },
    configured: true,
    ptSlabs: row.ptSlabs.map((s) => ({
      fromSalary: num(s.fromSalary),
      toSalary: s.toSalary == null ? null : num(s.toSalary),
      ptAmount: num(s.ptAmount),
      additionalAmount: num(s.additionalAmount),
    })),
    lwf: {
      state: row.lwfState,
      employee: num(row.lwfEmployee),
      employer: num(row.lwfEmployer),
      months: row.lwfMonths,
    },
  };
}

/**
 * Professional tax from a slab table (falls back to the flat threshold rule when
 * no slabs are configured). Slabs are inclusive of `fromSalary`; `toSalary: null`
 * means "and above". Returns 0 when no band matches.
 */
export function ptFromSlabs(
  monthlyGross: number,
  slabs: ResolvedStatConfig["ptSlabs"],
): number | null {
  if (slabs.length === 0) return null; // caller falls back to the flat rule
  const hit = slabs.find(
    (s) => monthlyGross >= s.fromSalary && (s.toSalary == null || monthlyGross <= s.toSalary),
  );
  if (!hit) return 0;
  return hit.ptAmount + hit.additionalAmount;
}

/** Is LWF deducted in this calendar month (1..12) for this entity? */
export function lwfDueThisMonth(lwf: ResolvedStatConfig["lwf"], month: number): boolean {
  return lwf.months.includes(month);
}
