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

/** The two management-fee engines (the food axis). */
export type ProjectionModel = "WITH_FOOD" | "WITHOUT_FOOD";

/**
 * Every value of the AcqProjectionModel Prisma enum — i.e. "which engine
 * produced this projection". REVENUE_MARGIN shares the enum (and therefore the
 * DRAFT → APPROVED → SENT lifecycle, the PDF and the approval guards) but runs a
 * different engine with a different input/output shape; see the union types and
 * the computeAnyProjection / validateAnyProjectionInputs dispatchers below.
 */
export type AcqProjectionModelType = ProjectionModel | "REVENUE_MARGIN";

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

/** The 8 shared operating-expense lines (no marketing, no food). */
function opexBaseLines(cap: number, sft: number): number {
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

/**
 * §4.1 — without-food opex = the 8 base lines + marketing.
 * Marketing is ₹20,000 at ≤100 seats and rises ₹20,000 for every additional
 * 100 seats of capacity → ceil(cap/100) × 20,000. (Food is excluded.)
 */
export function withoutFoodOpexY1(cap: number, sft: number): number {
  const marketing = Math.ceil(cap / 100) * 20000;
  return opexBaseLines(cap, sft) + marketing;
}

/** §4.2 — with-food opex = the 8 lines + marketing + food cost. Food uses events_base_case (per oracle). */
export function withFoodOpexY1(
  cap: number,
  sft: number,
  eventsBaseCase: number,
  cfg: ProjectionConfig = PROJECTION_CONST
): number {
  const marketing = Math.max(1, Math.ceil(cap / 200)) * 20000;
  const foodCost = cfg.FOOD_COST_PER_PLATE * cap * eventsBaseCase;
  return opexBaseLines(cap, sft) + marketing + foodCost;
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

// ============================================================
// REVENUE MARGIN model (AcqDealModel.REVENUE_MARGIN) — pure engine.
//
// A DIFFERENT axis from ProjectionModel (WITH_FOOD / WITHOUT_FOOD): that enum
// describes whether the owner supplies catering in the management-fee grids
// above. This block is the economics of the Revenue-Margin deal model, where we
// guarantee the owner a base price and resell at a best price.
//
// Owner's explicit shape:
//   • Headline  = FULL GROSS revenue      price × pax × events × 12
//   • Secondary = our margin (the spread) (best − base) × pax × events × 12
//   • NO opex participates in this model at all — that is why none of the
//     opex/GOP/management-fee lines above are reused here.
// ============================================================

export type RmPriceBasis = "PER_EVENT" | "PER_PAX";

export interface RevenueMarginInputs {
  /** Owner's guaranteed price (₹) — per event or per pax depending on basis. */
  basePrice: number;
  /** Price we expect to sell at (₹) — same basis as basePrice. */
  bestPrice: number;
  priceBasis: RmPriceBasis;
  /** Hall capacity — the hard ceiling on billable pax (PER_PAX only). */
  hallCapacity?: number | null;
  /** Minimum billable heads the owner charges for (PER_PAX only). */
  minimumPax?: number | null;
  /** Expected heads per event (PER_PAX only) before floor/cap are applied. */
  actualPax?: number | null;
  /** Events per month — the deal's expectedMonthlyEvents, or an explicit input. */
  eventsPerMonth: number;
}

/** Which rule set the billable pax (so the UI can explain the number). */
export type RmPaxBinding = "PER_EVENT" | "ACTUAL" | "MINIMUM" | "CAPACITY";

export interface RmCaseRow {
  kind: "BASE" | "BEST";
  /** The unit price used for this case (base or best). */
  price: number;
  /** Billable pax multiplier — always 1 on a PER_EVENT basis. */
  pax: number;
  eventsPerMonth: number;
  revenuePerEvent: number;
  monthlyRevenue: number;
  annualRevenue: number;
}

export interface RevenueMarginGrid {
  /** Discriminant shared with ProjectionGrid so a stored grid is self-describing. */
  modelType: "REVENUE_MARGIN";
  priceBasis: RmPriceBasis;
  /** Effective billable pax after the minimum floor and the capacity cap. */
  effectivePax: number;
  paxBinding: RmPaxBinding;
  eventsPerMonth: number;
  /** Headline gross at the owner's guaranteed price. */
  base: RmCaseRow;
  /** Headline gross at the price we expect to sell at. */
  best: RmCaseRow;
  /** Our margin = the spread only. Deliberately a SEPARATE secondary line. */
  margin: {
    spreadPerUnit: number;
    perEvent: number;
    monthly: number;
    annual: number;
  };
}

/**
 * Billable pax for a Revenue-Margin deal.
 * The minimum is applied BEFORE the cap, so when minimumPax > hallCapacity the
 * capacity is the binding limit (we cannot bill more heads than the hall seats).
 * That combination is a data-entry error and is rejected at input time, but the
 * engine still degrades safely rather than inventing volume.
 */
export function effectiveRmPax(i: {
  priceBasis: RmPriceBasis;
  actualPax?: number | null;
  minimumPax?: number | null;
  hallCapacity?: number | null;
}): { pax: number; binding: RmPaxBinding } {
  if (i.priceBasis === "PER_EVENT") return { pax: 1, binding: "PER_EVENT" };

  const actual = Math.max(0, i.actualPax ?? 0);
  const minimum = i.minimumPax ?? 0;
  const floored = Math.max(actual, minimum); // minimum FIRST
  const cap = i.hallCapacity ?? 0;
  if (cap > 0 && floored > cap) return { pax: cap, binding: "CAPACITY" };
  return { pax: floored, binding: minimum > actual ? "MINIMUM" : "ACTUAL" };
}

function rmCase(kind: "BASE" | "BEST", price: number, pax: number, events: number): RmCaseRow {
  const revenuePerEvent = price * pax; // pax === 1 on a PER_EVENT basis
  const monthlyRevenue = revenuePerEvent * events;
  return {
    kind,
    price,
    pax,
    eventsPerMonth: events,
    revenuePerEvent,
    monthlyRevenue,
    annualRevenue: monthlyRevenue * 12, // annualised, per the owner's definition
  };
}

export function computeRevenueMarginProjection(i: RevenueMarginInputs): RevenueMarginGrid {
  const { pax, binding } = effectiveRmPax(i);
  const events = i.eventsPerMonth;
  const base = rmCase("BASE", i.basePrice, pax, events);
  const best = rmCase("BEST", i.bestPrice, pax, events);
  const spreadPerUnit = i.bestPrice - i.basePrice;
  const perEvent = spreadPerUnit * pax;
  const monthly = perEvent * events;
  return {
    modelType: "REVENUE_MARGIN",
    priceBasis: i.priceBasis,
    effectivePax: pax,
    paxBinding: binding,
    eventsPerMonth: events,
    base,
    best,
    margin: { spreadPerUnit, perEvent, monthly, annual: monthly * 12 },
  };
}

/**
 * Input validation for the Revenue-Margin economics. Mirrored server-side in
 * acq-deal.actions.ts (persisting the fields) so the UI and the DB agree.
 */
export function validateRevenueMarginInputs(i: Partial<RevenueMarginInputs>): string[] {
  const errs: string[] = [];
  const numOk = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  const intOk = (v: unknown): v is number => numOk(v) && Number.isInteger(v);

  if (!numOk(i.basePrice) || i.basePrice < 0) errs.push("Base price must be a number ≥ 0.");
  if (!numOk(i.bestPrice) || i.bestPrice < 0) errs.push("Best price must be a number ≥ 0.");
  // A best price under the guaranteed base would mean we sell at a loss — that
  // is a data-entry error, not a scenario, so it is rejected outright.
  if (numOk(i.basePrice) && numOk(i.bestPrice) && i.bestPrice < i.basePrice) {
    errs.push("Best price can't be lower than the base price (that would be a negative margin).");
  }
  if (i.priceBasis !== "PER_EVENT" && i.priceBasis !== "PER_PAX") {
    errs.push("Choose whether the price is per event or per pax.");
  }
  if (i.hallCapacity != null && (!intOk(i.hallCapacity) || i.hallCapacity < 1)) {
    errs.push("Hall capacity must be a whole number ≥ 1.");
  }
  if (i.minimumPax != null && (!intOk(i.minimumPax) || i.minimumPax < 1)) {
    errs.push("Minimum pax must be a whole number ≥ 1.");
  }
  if (
    intOk(i.hallCapacity) && intOk(i.minimumPax) &&
    i.minimumPax > i.hallCapacity
  ) {
    errs.push("Minimum pax can't exceed the hall capacity.");
  }
  if (i.priceBasis === "PER_PAX") {
    if (!intOk(i.hallCapacity) || i.hallCapacity < 1) {
      errs.push("A per-pax price needs the hall capacity (it caps billable pax).");
    }
    if (!intOk(i.minimumPax) || i.minimumPax < 1) {
      errs.push("A per-pax price needs a minimum billable pax.");
    }
    if (!numOk(i.actualPax) || i.actualPax < 1) {
      errs.push("Expected pax per event is required for a per-pax price.");
    }
  }
  // Never silently assume a volume: events/month must be supplied.
  if (!numOk(i.eventsPerMonth) || i.eventsPerMonth <= 0) {
    errs.push("Events per month is required (set it on the deal economics or enter it here).");
  }
  return errs;
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

// ============================================================
// Cross-model dispatch.
//
// AcqProjection rows carry inputsJson / outputsJson as untyped JSON, and the
// modelType enum now selects between two engines with DIFFERENT shapes. Every
// caller (server actions, the live UI preview, the owner PDF) goes through the
// helpers below so the "which engine?" decision exists in exactly one place and
// a new enum value can't be silently ignored.
// ============================================================

export type AnyProjectionInputs = ProjectionInputs | RevenueMarginInputs;
export type AnyProjectionGrid = ProjectionGrid | RevenueMarginGrid;

/** Display names for the projection engines (used by the UI and the PDF). */
export const PROJECTION_MODEL_LABEL: Record<AcqProjectionModelType, string> = {
  WITHOUT_FOOD: "Hall-Only",
  WITH_FOOD: "With Food",
  REVENUE_MARGIN: "Revenue Margin",
};

/** Narrow a stored grid by its self-describing modelType discriminant. */
export function isRevenueMarginGrid(g: AnyProjectionGrid): g is RevenueMarginGrid {
  return g.modelType === "REVENUE_MARGIN";
}

const jsonNum = (v: unknown): number => (typeof v === "number" ? v : Number(v));
const jsonNumOrUndef = (v: unknown): number | undefined =>
  v == null || v === "" ? undefined : jsonNum(v);
const jsonNumOrNull = (v: unknown): number | null =>
  v == null || v === "" ? null : jsonNum(v);

/** Coerce a serialized inputsJson blob into WITH_FOOD / WITHOUT_FOOD inputs. */
export function asProjectionInputs(raw: unknown): ProjectionInputs {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    banquetSizeSft: jsonNum(o.banquetSizeSft),
    seatingCapacity: jsonNum(o.seatingCapacity),
    eventsBaseCase: jsonNum(o.eventsBaseCase),
    eventsBestCase: jsonNum(o.eventsBestCase),
    hourlyHallCharge: jsonNumOrUndef(o.hourlyHallCharge),
    hoursPerEvent: jsonNumOrUndef(o.hoursPerEvent),
    perPlateCharge: jsonNumOrUndef(o.perPlateCharge),
    bestCasePlateUplift: jsonNumOrUndef(o.bestCasePlateUplift),
  };
}

/**
 * Coerce a serialized inputsJson blob into Revenue-Margin inputs.
 * Everything the engine needs is stored on the row — including the pax and
 * events/month ASSUMPTIONS — so an approved projection stays reproducible even
 * after the deal's economics move on.
 */
export function asRevenueMarginInputs(raw: unknown): RevenueMarginInputs {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    basePrice: jsonNum(o.basePrice),
    bestPrice: jsonNum(o.bestPrice),
    priceBasis: o.priceBasis === "PER_PAX" ? "PER_PAX" : "PER_EVENT",
    hallCapacity: jsonNumOrNull(o.hallCapacity),
    minimumPax: jsonNumOrNull(o.minimumPax),
    actualPax: jsonNumOrNull(o.actualPax),
    eventsPerMonth: jsonNum(o.eventsPerMonth),
  };
}

/** Compute the grid for ANY projection model from a raw (JSON) input blob. */
export function computeAnyProjection(
  modelType: AcqProjectionModelType,
  raw: unknown,
  cfg: ProjectionConfig = PROJECTION_CONST
): AnyProjectionGrid {
  if (modelType === "REVENUE_MARGIN") {
    // No config: the Revenue-Margin model has no tunable assumptions — it is
    // pure arithmetic on the agreed prices, and no opex participates.
    return computeRevenueMarginProjection(asRevenueMarginInputs(raw));
  }
  return computeProjection(modelType, asProjectionInputs(raw), cfg);
}

/** Validate a raw (JSON) input blob for ANY projection model. */
export function validateAnyProjectionInputs(
  modelType: AcqProjectionModelType,
  raw: unknown
): string[] {
  if (modelType === "REVENUE_MARGIN") {
    return validateRevenueMarginInputs(asRevenueMarginInputs(raw));
  }
  return validateProjectionInputs(modelType, asProjectionInputs(raw));
}
