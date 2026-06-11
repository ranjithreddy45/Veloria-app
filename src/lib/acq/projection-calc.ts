// ============================================================
// BD CRM — Owner Projection Calculator (pure engine).
// Reproduces VG_Projection_WITH_FOOD.xlsx / WITHOUT_FOOD.xlsx
// to the rupee. No IO; this is the single source of truth that
// BOTH the live UI preview and the server snapshot import, so the
// on-screen grid and the sent PDF can never disagree.
//
// The §3 fixed assumptions are tunable via the AcqConfig table:
// computeProjection() takes an optional config; the DEFAULTS below
// equal the oracle, so omitting config keeps every test exact.
// ============================================================

export type ProjectionModel = "WITH_FOOD" | "WITHOUT_FOOD";

// Number of projection years shown (Years 4 & 5 dropped per product request).
export const PROJECTION_YEARS = 3;

export interface ProjectionConfig {
  EVENTS_RAMP: number[]; // per-year multiplier vs prior year (Y1 = 1)
  EVENTS_MAX_YEAR3: number; // hard cap on Year-3 events/month, BASE case (0 = no cap)
  EVENTS_MAX_YEAR3_BEST: number; // hard cap on Year-3 events/month, BEST case (0 = no cap)
  BASE_FEE_PCT: number; // of revenue
  INCENTIVE_PCT: number; // of GOP
  OPEX_YOY_GROWTH: number; // Yr2+ opex = prior * this
  WITHOUTFOOD_REV_YOY: number; // rev/event growth (without-food)
  WITHFOOD_PLATE_YOY: number; // per-plate growth (with-food)
  FOOD_COST_PER_PLATE: number;
  HALL_CHARGE_DEFAULT: number;
  HOURS_PER_EVENT_DEFAULT: number;
  BEST_CASE_PLATE_UPLIFT_DEFAULT: number;
}

// ---- Fixed assumptions (§3) — defaults == oracle. ----
export const PROJECTION_CONST: ProjectionConfig = {
  EVENTS_RAMP: [1, 1.3, 1.3, 1.1, 1.1],
  EVENTS_MAX_YEAR3: 40,
  EVENTS_MAX_YEAR3_BEST: 45,
  BASE_FEE_PCT: 0.05,
  INCENTIVE_PCT: 0.2,
  OPEX_YOY_GROWTH: 1.3,
  WITHOUTFOOD_REV_YOY: 1.05,
  WITHFOOD_PLATE_YOY: 1.1,
  FOOD_COST_PER_PLATE: 250,
  HALL_CHARGE_DEFAULT: 6999,
  HOURS_PER_EVENT_DEFAULT: 4,
  BEST_CASE_PLATE_UPLIFT_DEFAULT: 100,
};

export interface ProjectionInputs {
  bestCasePlateUplift?: number;
  banquetSizeSft: number;
  seatingCapacity: number;
  eventsBaseCase: number;
  eventsBestCase: number;
  // WITHOUT-FOOD
  hourlyHallCharge?: number;
  hoursPerEvent?: number;
  // WITH-FOOD
  perPlateCharge?: number;
}

export interface YearRow {
  year: number; // 1..5
  events: number;
  perPlate?: number; // with-food only
  revPerEvent: number;
  totalRevenue: number;
  opex: number;
  gop: number;
  baseFee: number;
  incentiveFee: number;
  mgmtFee: number;
  netOwnerReturn: number;
  ownerReturnPct: number; // 0..1
}

export interface ProjectionGrid {
  modelType: ProjectionModel;
  base: YearRow[];
  best: YearRow[];
}

// ---- Opex engines (§4). Fixed monthly; does not scale with events. ----

/** §4.1 — without-food opex lines (owner absorbs all). Marketing & food excluded. */
export function withoutFoodOpexY1(cap: number, sft: number): number {
  const electricity = sft * 16;
  const water = 1500 * 6;
  const housekeeping = (cap <= 100 ? 1 : 1 + Math.floor((cap - 1) / 100)) * 20000;
  const banquetManager = Math.ceil(cap / 300) * 30000;
  const mstSalary = Math.max(1, Math.ceil(cap / 100)) * 0.2 * 30000;
  const techFees = cap * 50;
  const misc = cap * 50;
  const laundry = cap * 100;
  return (
    electricity + water + housekeeping + banquetManager + mstSalary + techFees + misc + laundry
  );
}

/** §4.2 — with-food opex = the 8 lines + marketing + food cost. Food uses events_base_case (per oracle). */
export function withFoodOpexY1(
  cap: number,
  sft: number,
  eventsBaseCase: number,
  cfg: ProjectionConfig = PROJECTION_CONST
): number {
  const base = withoutFoodOpexY1(cap, sft);
  const marketing = Math.max(1, Math.ceil(cap / 200)) * 20000;
  const foodCost = cfg.FOOD_COST_PER_PLATE * cap * eventsBaseCase;
  return base + marketing + foodCost;
}

// ---- Shared per-year fee + return math (§5/§6) ----
function applyFees(totalRevenue: number, opex: number, cfg: ProjectionConfig) {
  const gop = totalRevenue - opex;
  const baseFee = totalRevenue * cfg.BASE_FEE_PCT;
  const incentiveFee = gop * cfg.INCENTIVE_PCT;
  const mgmtFee = baseFee + incentiveFee;
  const netOwnerReturn = totalRevenue - opex - mgmtFee;
  const ownerReturnPct = totalRevenue > 0 ? netOwnerReturn / totalRevenue : 0; // guard div/0
  return { gop, baseFee, incentiveFee, mgmtFee, netOwnerReturn, ownerReturnPct };
}

function eventSeries(y1Events: number, cfg: ProjectionConfig, isBest: boolean): number[] {
  const cap = isBest ? cfg.EVENTS_MAX_YEAR3_BEST : cfg.EVENTS_MAX_YEAR3;
  const out: number[] = [];
  let prev = 0;
  for (let i = 0; i < PROJECTION_YEARS; i++) {
    let v = i === 0 ? y1Events : prev * (cfg.EVENTS_RAMP[i] ?? 1);
    // Year 3 (index 2) is capped at the venue's max monthly events — base 40, best 45.
    if (i === 2 && cap > 0) v = Math.min(v, cap);
    out.push(v);
    prev = v;
  }
  return out;
}

// ---- WITHOUT-FOOD (§5) ----
function computeWithoutFood(inputs: ProjectionInputs, isBest: boolean, cfg: ProjectionConfig): YearRow[] {
  const cap = inputs.seatingCapacity;
  const sft = inputs.banquetSizeSft;
  const hall = inputs.hourlyHallCharge ?? cfg.HALL_CHARGE_DEFAULT;
  const hours = inputs.hoursPerEvent ?? cfg.HOURS_PER_EVENT_DEFAULT;
  const events = eventSeries(isBest ? inputs.eventsBestCase : inputs.eventsBaseCase, cfg, isBest);

  const rows: YearRow[] = [];
  let revPerEvent = hall * hours;
  let opex = withoutFoodOpexY1(cap, sft);
  for (let i = 0; i < PROJECTION_YEARS; i++) {
    if (i > 0) {
      revPerEvent = revPerEvent * cfg.WITHOUTFOOD_REV_YOY;
      opex = opex * cfg.OPEX_YOY_GROWTH;
    }
    const totalRevenue = events[i] * revPerEvent;
    const f = applyFees(totalRevenue, opex, cfg);
    rows.push({ year: i + 1, events: events[i], revPerEvent, totalRevenue, opex, ...f });
  }
  return rows;
}

// ---- WITH-FOOD (§6) ----
function computeWithFood(inputs: ProjectionInputs, isBest: boolean, cfg: ProjectionConfig): YearRow[] {
  const cap = inputs.seatingCapacity;
  const sft = inputs.banquetSizeSft;
  const seats = cap;
  const uplift = isBest ? inputs.bestCasePlateUplift ?? cfg.BEST_CASE_PLATE_UPLIFT_DEFAULT : 0;
  const events = eventSeries(isBest ? inputs.eventsBestCase : inputs.eventsBaseCase, cfg, isBest);

  // Food cost (inside opex Y1) ALWAYS uses events_base_case, even in the best block (oracle).
  const rows: YearRow[] = [];
  let perPlate = (inputs.perPlateCharge ?? 0) + uplift;
  let opex = withFoodOpexY1(cap, sft, inputs.eventsBaseCase, cfg);
  for (let i = 0; i < PROJECTION_YEARS; i++) {
    if (i > 0) {
      perPlate = perPlate * cfg.WITHFOOD_PLATE_YOY;
      opex = opex * cfg.OPEX_YOY_GROWTH;
    }
    const revPerEvent = perPlate * seats; // recomputed each year
    const totalRevenue = events[i] * revPerEvent;
    const f = applyFees(totalRevenue, opex, cfg);
    rows.push({ year: i + 1, events: events[i], perPlate, revPerEvent, totalRevenue, opex, ...f });
  }
  return rows;
}

export function computeProjection(
  model: ProjectionModel,
  inputs: ProjectionInputs,
  cfg: ProjectionConfig = PROJECTION_CONST
): ProjectionGrid {
  if (model === "WITHOUT_FOOD") {
    return {
      modelType: model,
      base: computeWithoutFood(inputs, false, cfg),
      best: computeWithoutFood(inputs, true, cfg),
    };
  }
  return {
    modelType: model,
    base: computeWithFood(inputs, false, cfg),
    best: computeWithFood(inputs, true, cfg),
  };
}

// ---- Input validation (§Screen 2 / acceptance) ----
export function validateProjectionInputs(
  model: ProjectionModel,
  i: Partial<ProjectionInputs>
): string[] {
  const errs: string[] = [];
  const numOk = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
  if (!numOk(i.seatingCapacity) || (i.seatingCapacity ?? 0) < 1) errs.push("Seating capacity must be ≥ 1.");
  if (!numOk(i.banquetSizeSft)) errs.push("Banquet size (sft) is required.");
  if (!numOk(i.eventsBaseCase) || (i.eventsBaseCase ?? 0) < 1) errs.push("Events (base case) must be ≥ 1.");
  if (!numOk(i.eventsBestCase) || (i.eventsBestCase ?? 0) < 1) errs.push("Events (best case) must be ≥ 1.");
  if (model === "WITHOUT_FOOD") {
    if (!numOk(i.hourlyHallCharge)) errs.push("Hourly hall charge is required.");
    if (!numOk(i.hoursPerEvent) || (i.hoursPerEvent ?? 0) < 1) errs.push("Hours per event must be ≥ 1.");
  } else {
    if (!numOk(i.perPlateCharge)) errs.push("Per-plate charge is required.");
    if (i.bestCasePlateUplift != null && !numOk(i.bestCasePlateUplift)) errs.push("Best-case uplift must be ≥ 0.");
  }
  return errs;
}
