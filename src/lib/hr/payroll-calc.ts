// ============================================================
// HR payroll compute engine — PURE (no IO), the single source of
// truth for Indian salary + statutory math used by payslips, the
// salary-structure builder, and full-&-final settlement.
// ------------------------------------------------------------
// IMPORTANT: statutory rules change every Union Budget. Every rate,
// slab and cap lives in DEFAULT_STAT_CONFIG below and can be
// overridden per call — never hard-code a number inside the math.
// Defaults reflect the **New Tax Regime, FY 2026-27 (AY 2027-28)**
// and Karnataka professional tax. These are estimates for monthly
// TDS projection; actual year-end liability depends on the
// employee's declarations and proofs.
// ============================================================

export type StatutoryType = "NONE" | "PF" | "ESI" | "PT" | "TDS" | "GRATUITY";
export type PayComponentKind = "EARNING" | "DEDUCTION";
export type PayCalcType = "FLAT" | "PCT_OF_BASIC" | "PCT_OF_CTC" | "BALANCE";

/** A configurable pay head as defined by the admin. */
export interface PayComponentDef {
  code: string;
  name: string;
  kind: PayComponentKind;
  calcType: PayCalcType;
  rate: number; // percent when calcType is PCT_*
  taxable: boolean;
  partOfCtc: boolean;
  statutory: StatutoryType;
  order: number;
}

/** A resolved monthly line, snapshotted onto a salary structure. */
export interface StructureLine {
  code: string;
  name: string;
  kind: PayComponentKind;
  monthly: number;
  taxable: boolean;
  statutory: StatutoryType;
}

export interface StatConfig {
  // --- Provident Fund (employee share) ---
  pfRatePct: number; // 12%
  pfWageCeiling: number; // basic capped at 15,000 for statutory PF
  pfOnFullBasic: boolean; // if true, ignore the ceiling
  // --- Provident Fund (EMPLOYER share) ---
  // The employer also contributes 12% of PF wages, split into the pension fund
  // (EPS) and the balance to EPF. EPS is always computed on wages capped at
  // `epsWageCeiling` (₹15,000 → ₹1,250 max) EVEN when the employee contributes
  // on full basic; the remainder of the employer's 12% goes to EPF.
  employerPfRatePct: number; // 12%
  epsRatePct: number; // 8.33%
  epsWageCeiling: number; // 15,000 → EPS caps at ₹1,250
  epsApplicable: boolean; // false → whole employer 12% goes to EPF
  edliRatePct: number; // 0.5% (A/c 21)
  edliWageCeiling: number; // 15,000 → EDLI caps at ₹75
  pfAdminRatePct: number; // 0.5% (A/c 2)
  // --- ESI (employee share) ---
  esiRatePct: number; // 0.75%
  employerEsiRatePct: number; // 3.25%
  esiGrossCeiling: number; // applies only when monthly gross <= 21,000
  // Employees at or below this AVERAGE DAILY wage are exempt from the EMPLOYEE
  // ESI leg (ESIC ~₹176/day). 0 (default) disables the exemption. The employer
  // leg is unaffected.
  esiMinDailyWage?: number;
  // --- Professional Tax (Karnataka default; state slabs override the flat rule) ---
  ptAmount: number; // 200
  ptGrossThreshold: number; // charged when monthly gross > 25,000
  // Optional graduated PT slab table (e.g. Maharashtra). When present it REPLACES
  // the flat ptAmount/ptGrossThreshold rule. `additionalAmount` is a February-only
  // top-up (the standard state convention). Empty/undefined → flat rule applies.
  ptSlabs?: { fromSalary: number; toSalary: number | null; ptAmount: number; additionalAmount: number }[];
  // --- Labour Welfare Fund (deducted only in the configured calendar months) ---
  lwfEmployee?: number; // employee share (₹), deducted in lwfMonths
  lwfEmployer?: number; // employer share (₹), added to employer cost in lwfMonths
  lwfMonths?: number[]; // calendar months (1..12) LWF is due in
  // --- Gratuity ---
  gratuityDaysPerYear: number; // 15
  gratuityMonthDivisor: number; // 26
  gratuityMinYears: number; // 5 — eligibility for payout
  // --- Income tax (New Regime) ---
  stdDeductionAnnual: number; // 75,000
  rebateIncomeCeiling: number; // <= 12,00,000 taxable => full rebate
  rebateMax: number; // 60,000
  cessPct: number; // 4%
  slabs: { upTo: number | null; ratePct: number }[]; // null upTo = "and above"
}

export const DEFAULT_STAT_CONFIG: StatConfig = {
  pfRatePct: 12,
  pfWageCeiling: 15000,
  pfOnFullBasic: false,
  employerPfRatePct: 12,
  epsRatePct: 8.33,
  epsWageCeiling: 15000,
  epsApplicable: true,
  edliRatePct: 0.5,
  edliWageCeiling: 15000,
  pfAdminRatePct: 0.5,
  esiRatePct: 0.75,
  employerEsiRatePct: 3.25,
  esiGrossCeiling: 21000,
  ptAmount: 200,
  ptGrossThreshold: 25000,
  gratuityDaysPerYear: 15,
  gratuityMonthDivisor: 26,
  gratuityMinYears: 5,
  stdDeductionAnnual: 75000,
  rebateIncomeCeiling: 1200000,
  rebateMax: 60000,
  cessPct: 4,
  // New Regime slabs (FY 2026-27). upTo is the top of the band.
  slabs: [
    { upTo: 400000, ratePct: 0 },
    { upTo: 800000, ratePct: 5 },
    { upTo: 1200000, ratePct: 10 },
    { upTo: 1600000, ratePct: 15 },
    { upTo: 2000000, ratePct: 20 },
    { upTo: 2400000, ratePct: 25 },
    { upTo: null, ratePct: 30 },
  ],
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const rupee = (n: number) => Math.round(n); // statutory amounts are whole rupees
// ESI contributions round UP to the next whole rupee (ESIC Regulation 40), unlike
// PF/EPS which round to nearest. The −1e-6 absorbs float dust so an exact rupee
// (e.g. 150.0000001) is not pushed to 151.
const ceilRupee = (n: number) => Math.ceil(n - 1e-6);

/**
 * Resolve a monthly CTC + basic% + component defs into concrete monthly
 * lines. Order of resolution: BASIC first (basicPct of monthly CTC), then
 * FLAT / PCT_OF_BASIC / PCT_OF_CTC earnings, then a single BALANCE head
 * (usually "Special Allowance") absorbs whatever is left so earnings that
 * are part of CTC sum exactly to the monthly CTC. Statutory deductions are
 * NOT included here — they are computed per-run by computePayslip.
 */
export function buildStructureLines(
  monthlyCtc: number,
  basicPct: number,
  components: PayComponentDef[],
  cfg: StatConfig = DEFAULT_STAT_CONFIG,
): StructureLine[] {
  void cfg;
  const basic = r2((monthlyCtc * basicPct) / 100);
  const lines: StructureLine[] = [
    { code: "BASIC", name: "Basic", kind: "EARNING", monthly: basic, taxable: true, statutory: "NONE" },
  ];

  const earnings = components
    .filter((c) => c.kind === "EARNING" && c.code !== "BASIC")
    .sort((a, b) => a.order - b.order);

  let balanceDef: PayComponentDef | null = null;
  for (const c of earnings) {
    if (c.calcType === "BALANCE") {
      balanceDef = c; // resolve last
      continue;
    }
    let monthly = 0;
    if (c.calcType === "FLAT") monthly = c.rate; // FLAT stores the amount in rate
    else if (c.calcType === "PCT_OF_BASIC") monthly = (basic * c.rate) / 100;
    else if (c.calcType === "PCT_OF_CTC") monthly = (monthlyCtc * c.rate) / 100;
    lines.push({
      code: c.code,
      name: c.name,
      kind: "EARNING",
      monthly: r2(monthly),
      taxable: c.taxable,
      statutory: c.statutory,
    });
  }

  // BALANCE (special allowance) = monthly CTC − everything that is part of CTC.
  const ctcConsumed = lines
    .filter((l) => l.code !== "BASIC")
    .reduce((s, l) => s + l.monthly, basic);
  if (balanceDef) {
    const bal = r2(Math.max(0, monthlyCtc - ctcConsumed));
    lines.push({
      code: balanceDef.code,
      name: balanceDef.name,
      kind: "EARNING",
      monthly: bal,
      taxable: balanceDef.taxable,
      statutory: balanceDef.statutory,
    });
  }

  // Standing DEDUCTION heads (e.g. a fixed monthly recovery) resolve like earnings
  // but are emitted as DEDUCTION lines so computePayslip nets them out. Previously
  // deduction components existed in the master but were never consumed into any
  // structure, so they silently did nothing.
  const deductionDefs = components
    .filter((c) => c.kind === "DEDUCTION")
    .sort((a, b) => a.order - b.order);
  for (const c of deductionDefs) {
    let monthly = 0;
    if (c.calcType === "FLAT") monthly = c.rate;
    else if (c.calcType === "PCT_OF_BASIC") monthly = (basic * c.rate) / 100;
    else if (c.calcType === "PCT_OF_CTC") monthly = (monthlyCtc * c.rate) / 100;
    if (monthly > 0)
      lines.push({
        code: c.code,
        name: c.name,
        kind: "DEDUCTION",
        monthly: r2(monthly),
        taxable: false,
        statutory: c.statutory,
      });
  }
  return lines;
}

/** Annual income tax under the New Regime (with 87A rebate + cess). */
export function newRegimeAnnualTax(taxableAnnual: number, cfg: StatConfig = DEFAULT_STAT_CONFIG): number {
  const income = Math.max(0, taxableAnnual);
  let tax = 0;
  let lower = 0;
  for (const band of cfg.slabs) {
    const upper = band.upTo ?? Infinity;
    if (income > lower) {
      const slabIncome = Math.min(income, upper) - lower;
      tax += (slabIncome * band.ratePct) / 100;
    }
    lower = upper;
    if (income <= lower) break;
  }
  // Section 87A rebate — full relief up to the ceiling.
  if (income <= cfg.rebateIncomeCeiling) tax = Math.max(0, tax - cfg.rebateMax);
  if (tax < 0) tax = 0;
  const withCess = tax * (1 + cfg.cessPct / 100);
  return rupee(withCess);
}

/**
 * Professional tax from a graduated state slab table. Slabs are inclusive of
 * `fromSalary`; `toSalary: null` means "and above". `additionalAmount` is a
 * February-only top-up (the standard state convention, e.g. Maharashtra's ₹300
 * in Feb vs ₹200 otherwise). Returns null when no slabs are configured so the
 * caller falls back to the flat threshold rule; 0 when no band matches.
 */
function ptSlabAmount(
  monthlyGross: number,
  slabs: StatConfig["ptSlabs"],
  month?: number,
): number | null {
  if (!slabs || slabs.length === 0) return null;
  const hit = slabs.find(
    (s) => monthlyGross >= s.fromSalary && (s.toSalary == null || monthlyGross <= s.toSalary),
  );
  if (!hit) return 0;
  return hit.ptAmount + (month === 2 ? hit.additionalAmount : 0);
}

export interface PayslipInput {
  lines: StructureLine[]; // the employee's current structure lines
  lopDays?: number; // loss-of-pay days (SAME unit as payableDays)
  /**
   * The payable base LOP is measured against. Pass the month's WORKING days
   * (from the attendance sheet) so LOP is deducted per working day; if omitted
   * we fall back to monthDays (calendar-day proration). lopDays MUST be in the
   * same unit as this base.
   */
  payableDays?: number;
  monthDays?: number; // calendar days in the month (default 30)
  cfg?: StatConfig;
  /** Calendar month 1..12 — drives the PT February top-up and LWF due-months. */
  month?: number;
  /**
   * Number of months this employee is actually paid in the financial year (used
   * to annualise TDS). Defaults to 12; pass a smaller value for a mid-year joiner
   * so their annual tax isn't over-projected as if they worked the whole year.
   */
  taxMonthsInYear?: number;
  /**
   * Retrospective arrears paid THIS month. Each carries its own statutory
   * applicability because the treatment depends on what the arrear is for.
   * Arrears are NOT pro-rated for LOP — they are a fixed back-dated sum.
   */
  arrears?: ArrearInput[];
  /**
   * Expense reimbursements disbursed THIS month. Paid against actual bills, so
   * they are fixed (never LOP-prorated) and attract NO PF/ESI/PT; only a taxable
   * reimbursement adds to the income-tax base.
   */
  reimbursements?: ReimbursementInput[];
}

export interface ReimbursementInput {
  amount: number;
  taxable?: boolean; // default false
  code?: string;
  name?: string;
}

export interface ArrearInput {
  amount: number;
  taxable?: boolean; // default true
  pfApplicable?: boolean; // arrear of PF-wages → folds into the PF base
  esiApplicable?: boolean;
  ptApplicable?: boolean;
}

export interface PayslipComputation {
  paidDays: number;
  lopDays: number;
  earnings: { code: string; name: string; amount: number }[];
  deductions: { code: string; name: string; amount: number }[];
  gross: number; // total earnings paid this month (INCLUDING arrears + reimbursements)
  arrears: number; // arrear amount folded into this month
  reimbursements: number; // reimbursement amount folded into this month
  basic: number; // paid basic this month
  pf: number;
  esi: number;
  pt: number;
  tds: number;
  lwf: number;
  gratuityAccrued: number;
  totalDeductions: number;
  net: number;
  // --- Employer cost (NOT deducted from the employee) ---
  employerEps: number; // pension fund, capped
  employerEpf: number; // employer 12% minus EPS
  employerPf: number; // employerEps + employerEpf
  employerEdli: number; // A/c 21
  employerPfAdmin: number; // A/c 2
  employerEsi: number; // 3.25%
  employerCost: number; // employerPf + edli + admin + employerEsi + gratuityAccrued
  ctc: number; // gross + employerCost
}

/**
 * Compute one month's payslip from the structure lines, pro-rated for LOP.
 * All statutory deductions are derived from law (config), never from a flat
 * stored value. TDS is the projected monthly tax = annual tax / 12 on the
 * annualised taxable earnings.
 */
export function computePayslip(input: PayslipInput): PayslipComputation {
  const cfg = input.cfg ?? DEFAULT_STAT_CONFIG;
  const monthDays = input.monthDays && input.monthDays > 0 ? input.monthDays : 30;
  // LOP is deducted against the payable base — the month's WORKING days when
  // supplied (matching the attendance sheet's unit), else calendar days. This
  // keeps the LOP numerator and the proration denominator in the SAME unit, so
  // a full-month absence yields zero pay (not a calendar-vs-working mismatch).
  const base = input.payableDays && input.payableDays > 0 ? input.payableDays : monthDays;
  const lopDays = Math.max(0, Math.min(input.lopDays ?? 0, base));
  const paidDays = base - lopDays;
  const payFactor = base > 0 ? paidDays / base : 1;

  const earnLines = input.lines.filter((l) => l.kind === "EARNING");
  const earnings = earnLines.map((l) => ({
    code: l.code,
    name: l.name,
    amount: r2(l.monthly * payFactor),
  }));
  const gross = r2(earnings.reduce((s, e) => s + e.amount, 0));
  // FULL (un-prorated) figures decide statutory ELIGIBILITY — coverage is set by
  // the contractual wage, not by how much a low-attendance month actually paid.
  const fullGross = r2(earnLines.reduce((s, l) => s + l.monthly, 0));
  const fullTaxableMonthly = r2(earnLines.filter((l) => l.taxable).reduce((s, l) => s + l.monthly, 0));
  const fullBasic = input.lines.find((l) => l.code === "BASIC")?.monthly ?? 0;
  const basic = r2(fullBasic * payFactor);

  // ---- Arrears folded into THIS month (not pro-rated — a fixed back-dated sum).
  // Each carries its own statutory applicability, so we sum per statute.
  const arr = input.arrears ?? [];
  const arrTotal = r2(arr.reduce((s, a) => s + (a.amount || 0), 0));
  const arrPf = r2(arr.filter((a) => a.pfApplicable).reduce((s, a) => s + a.amount, 0));
  const arrEsi = r2(arr.filter((a) => a.esiApplicable).reduce((s, a) => s + a.amount, 0));
  const arrPt = r2(arr.filter((a) => a.ptApplicable).reduce((s, a) => s + a.amount, 0));
  const arrTaxable = r2(arr.filter((a) => a.taxable !== false).reduce((s, a) => s + a.amount, 0));
  if (arrTotal > 0) earnings.push({ code: "ARREAR", name: "Arrears", amount: arrTotal });

  // ---- Reimbursements paid THIS month (fixed, non-prorated, non-statutory).
  // Only a TAXABLE reimbursement touches the income-tax base; none attract PF/ESI/PT.
  const reimb = input.reimbursements ?? [];
  const reimbTotal = r2(reimb.reduce((s, r) => s + (r.amount || 0), 0));
  const reimbTaxable = r2(reimb.filter((r) => r.taxable).reduce((s, r) => s + r.amount, 0));
  if (reimbTotal > 0) earnings.push({ code: "REIMB", name: "Reimbursements", amount: reimbTotal });

  // grossPaid = this month's regular wages (the base for statutory contributions);
  // grossOut adds arrears + reimbursements for what actually lands in the bank.
  const grossOut = r2(gross + arrTotal + reimbTotal);

  // Pay exists if regular wages OR an arrear are being paid.
  const hasPay = grossOut > 0;

  // ---- Statutory deductions ----
  // PF: 12% of PF-wages actually paid. A PF-applicable arrear folds into the wage
  // base BEFORE the ceiling, so PF is never double-charged past ₹15,000.
  const pfBase = cfg.pfOnFullBasic ? basic + arrPf : Math.min(basic + arrPf, cfg.pfWageCeiling);
  const pf = rupee((pfBase * cfg.pfRatePct) / 100);

  // ESI: eligibility on the FULL contractual gross (an arrear doesn't move you in
  // or out of coverage); contribution on wages PAID + any ESI-applicable arrear,
  // rounded UP to the next rupee (ESIC Reg. 40). Low-wage exemption: an employee
  // at/below the configured average daily wage is exempt from the EMPLOYEE leg
  // (the employer leg still applies).
  const esiBase = r2(gross + arrEsi);
  const esiEligible = fullGross <= cfg.esiGrossCeiling && esiBase > 0;
  const dailyWage = monthDays > 0 ? fullGross / monthDays : 0;
  const esiEmployeeExempt = (cfg.esiMinDailyWage ?? 0) > 0 && dailyWage <= (cfg.esiMinDailyWage ?? 0);
  const esi = esiEligible && !esiEmployeeExempt ? ceilRupee((esiBase * cfg.esiRatePct) / 100) : 0;

  // PT: levied on the wages actually PAID this month (LOP-prorated regular gross +
  // any PT-applicable arrear) — NOT the un-prorated contractual gross, so a heavy-
  // LOP or fully-absent month isn't charged PT on salary never earned. A state
  // slab table, when configured, REPLACES the flat threshold rule; February
  // carries the state's top-up. Charged at most once (never doubled for arrears).
  const ptBase = r2(gross + arrPt);
  const ptSlab = ptSlabAmount(ptBase, cfg.ptSlabs, input.month);
  const pt = !hasPay
    ? 0
    : ptSlab != null
      ? ptSlab
      : ptBase >= cfg.ptGrossThreshold
        ? cfg.ptAmount
        : 0;

  // TDS: annualise the regular monthly taxable over the months this employee is
  // actually paid in the FY (default 12) — a mid-year joiner is projected on their
  // real annual earning, not a full 12 months. A one-off LOP month uses the
  // un-prorated fullTaxableMonthly so attendance doesn't swing the projection. An
  // arrear adds to annual taxable ONCE and its incremental tax is charged in full
  // this month. NOTE: Section 89(1) relief on arrears is the employee's to claim
  // and is deliberately NOT auto-applied here.
  const taxMonths = input.taxMonthsInYear && input.taxMonthsInYear > 0 ? Math.min(12, input.taxMonthsInYear) : 12;
  const annualTaxable = Math.max(0, fullTaxableMonthly * taxMonths - cfg.stdDeductionAnnual);
  const annualTax = newRegimeAnnualTax(annualTaxable, cfg);
  // A taxable arrear OR a taxable reimbursement adds to annual taxable ONCE; its
  // incremental tax is charged in full this month (Section 89(1) relief on arrears
  // is the employee's to claim and is NOT auto-applied).
  const extraTaxable = r2(arrTaxable + reimbTaxable);
  const oneOffTax =
    extraTaxable > 0 ? Math.max(0, newRegimeAnnualTax(annualTaxable + extraTaxable, cfg) - annualTax) : 0;
  const tds = r2((gross > 0 ? annualTax / taxMonths : 0) + oneOffTax);

  // LWF: a small fixed levy due only in the state's configured months.
  const lwfDue = hasPay && (cfg.lwfMonths ?? []).includes(input.month ?? 0);
  const lwf = lwfDue ? r2(cfg.lwfEmployee ?? 0) : 0;
  const employerLwf = lwfDue ? r2(cfg.lwfEmployer ?? 0) : 0;

  // Gratuity accrual (employer cost, shown for information; not deducted).
  const gratuityAccrued = rupee(
    (fullBasic * cfg.gratuityDaysPerYear) / cfg.gratuityMonthDivisor / 12,
  );

  // ---- Employer contributions (cost to company; never deducted from the employee) ----
  // The employer matches 12% of PF wages, but it is SPLIT:
  //   EPS (pension) = 8.33% of PF wages capped at ₹15,000  → max ₹1,250
  //   EPF (employer) = employer 12% − EPS
  // The EPS ceiling applies even when the employee contributes on full basic
  // (pfOnFullBasic), which is why EPS is computed off its own capped base.
  const employerPfBase = pfBase; // same wage base as the employee leg
  const employerPfTotal = rupee((employerPfBase * cfg.employerPfRatePct) / 100);
  const epsBase = Math.min(employerPfBase, cfg.epsWageCeiling);
  const employerEps = cfg.epsApplicable ? rupee((epsBase * cfg.epsRatePct) / 100) : 0;
  // Never let EPS exceed the employer's total contribution (guards a misconfigured
  // epsRatePct > employerPfRatePct from producing a negative EPF leg).
  const employerEpsCapped = Math.min(employerEps, employerPfTotal);
  const employerEpf = rupee(employerPfTotal - employerEpsCapped);

  // EDLI (A/c 21) — 0.5% of PF wages capped at ₹15,000 → max ₹75.
  const employerEdli = rupee((Math.min(employerPfBase, cfg.edliWageCeiling) * cfg.edliRatePct) / 100);
  // PF admin charges (A/c 2) — 0.5% of PF wages. NOTE: the statutory ₹500/month
  // minimum is an ESTABLISHMENT-level floor, not per employee, so it is applied
  // at the run level (if at all), never multiplied across every payslip here.
  const employerPfAdmin = rupee((employerPfBase * cfg.pfAdminRatePct) / 100);

  // Employer ESI — same eligibility rule as the employee leg (FULL gross within
  // the ceiling), contribution on wages actually PAID, rounded UP (Reg. 40). The
  // low-wage exemption is employEE-only, so the employer leg keeps eligibility.
  const employerEsi = esiEligible ? ceilRupee((esiBase * cfg.employerEsiRatePct) / 100) : 0;

  const employerPf = rupee(employerEpsCapped + employerEpf);
  const employerCost = rupee(employerPf + employerEdli + employerPfAdmin + employerEsi + employerLwf + gratuityAccrued);
  const ctc = rupee(grossOut + employerCost);

  const statDeductions = [
    { code: "PF", name: "Provident Fund", amount: pf },
    { code: "ESI", name: "ESI", amount: esi },
    { code: "PT", name: "Professional Tax", amount: pt },
    { code: "TDS", name: "TDS (Income Tax)", amount: tds },
    { code: "LWF", name: "Labour Welfare Fund", amount: lwf },
  ].filter((d) => d.amount > 0);

  // Any explicit DEDUCTION components on the structure (e.g. recoveries).
  const otherDeductions = input.lines
    .filter((l) => l.kind === "DEDUCTION")
    .map((l) => ({ code: l.code, name: l.name, amount: r2(l.monthly * payFactor) }));

  const deductions = [...statDeductions, ...otherDeductions];
  const totalDeductions = r2(deductions.reduce((s, d) => s + d.amount, 0));
  const net = r2(grossOut - totalDeductions);

  return {
    paidDays,
    lopDays,
    earnings,
    deductions,
    gross: grossOut,
    arrears: arrTotal,
    reimbursements: reimbTotal,
    basic,
    pf,
    esi,
    pt,
    tds,
    lwf,
    gratuityAccrued,
    totalDeductions,
    net,
    employerEps: employerEpsCapped,
    employerEpf,
    employerPf,
    employerEdli,
    employerPfAdmin,
    employerEsi,
    employerCost,
    ctc,
  };
}

/**
 * Statutory gratuity payout on separation: (15/26) × last drawn basic ×
 * completed years of service. Payable only at/above the eligibility years
 * (5), except death/disablement (caller may pass force=true).
 */
export function gratuityPayout(
  lastMonthlyBasic: number,
  completedYears: number,
  cfg: StatConfig = DEFAULT_STAT_CONFIG,
  force = false,
): number {
  if (!force && completedYears < cfg.gratuityMinYears) return 0;
  // Payment of Gratuity Act: a final year with MORE than 6 months of service
  // counts as a full year (round up), otherwise round down.
  const whole = Math.floor(completedYears);
  const years = Math.max(0, completedYears - whole > 0.5 ? whole + 1 : whole);
  return rupee((lastMonthlyBasic * cfg.gratuityDaysPerYear * years) / cfg.gratuityMonthDivisor);
}

/** Per-day pay for leave encashment = monthly basic (or gross) / month divisor. */
export function perDayPay(monthlyAmount: number, cfg: StatConfig = DEFAULT_STAT_CONFIG): number {
  return r2(monthlyAmount / cfg.gratuityMonthDivisor);
}

/** Completed years of service between two dates (fractional). */
export function completedYearsBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  if (ms <= 0) return 0;
  return ms / (365.25 * 24 * 3600 * 1000);
}
