// ============================================================
// Sales CRM — Quotation Calculator (pure engine).
// Reproduces "Veloria Grand Quotation Planner.xlsx" to the rupee.
// No IO; this is the SINGLE source of truth that BOTH the live
// on-screen calculator preview AND the server-side snapshot/PDF
// import, so the quote a customer sees can never disagree with the
// quote we stored. The catalog (package prices, decor, etc.) comes
// straight from the planner's dropdown lists.
// ============================================================

// 5% tax on the (post-discount) subtotal — matches the planner's "Tax 5%".
export const QUOTE_TAX_RATE = 0.05;

// Default hotel room charge (planner "Hotel Room Charges").
export const DEFAULT_ROOM_CHARGE = 2500;

// ---- Catalog (from the planner's data-validation dropdowns) ----

export interface FoodPackage {
  id: string;
  label: string;
  perPlate: number;
  veg: boolean;
}
export interface FixedItem {
  id: string;
  label: string;
  amount: number;
}
export interface CakeOption {
  id: string;
  label: string;
  ratePerKg: number;
}

export interface QuoteCatalog {
  timeSlots: string[];
  // "Without food" mode: hall charged per hour at one of these rates.
  hallRates: number[];
  food: FoodPackage[];
  decor: FixedItem[];
  activity: FixedItem[];
  cake: CakeOption[];
  // `amount: null` means "other" — the user types a custom amount.
  photography: { id: string; label: string; amount: number | null }[];
}

export const QUOTE_CATALOG: QuoteCatalog = {
  timeSlots: ["Afternoon", "Evening", "Full Day"],
  hallRates: [5999, 6999, 7999, 8999, 9999, 12999],
  food: [
    { id: "veg_silver", label: "Veg Silver package", perPlate: 599, veg: true },
    { id: "veg_gold", label: "Veg Gold package", perPlate: 699, veg: true },
    { id: "veg_platinum", label: "Veg Platinum package", perPlate: 899, veg: true },
    { id: "veg_diamond", label: "Veg Diamond package", perPlate: 1199, veg: true },
    { id: "nonveg_classic", label: "Classic Non-veg", perPlate: 899, veg: false },
    { id: "nonveg_premium", label: "Premium Non-veg", perPlate: 1099, veg: false },
    { id: "nonveg_luxury", label: "Luxury Non-veg", perPlate: 1299, veg: false },
  ],
  decor: [
    { id: "bday_single", label: "B'day single", amount: 10000 },
    { id: "bday_double", label: "B'day double", amount: 16000 },
    { id: "bday_triple", label: "B'day triple", amount: 20000 },
    { id: "engagement", label: "Engagement", amount: 25000 },
    { id: "babyshower_basic", label: "Baby shower basic", amount: 19500 },
    { id: "babyshower_premium", label: "Baby shower premium", amount: 35000 },
    { id: "wedding_premium", label: "Wedding Premium", amount: 75000 },
    { id: "led_back_12_8", label: "LED back screen 12/8", amount: 15000 },
    { id: "led_10_20", label: "LED screen 10/20", amount: 30000 },
  ],
  activity: [
    { id: "balloon", label: "Balloon", amount: 2000 },
    { id: "keychain", label: "Keychain", amount: 3000 },
    { id: "caricature", label: "Caricature", amount: 3000 },
  ],
  cake: [
    { id: "premium", label: "Premium", ratePerKg: 2000 },
    { id: "basic", label: "Basic", ratePerKg: 1500 },
  ],
  photography: [
    { id: "bday", label: "B'day", amount: 15000 },
    { id: "other", label: "Other (custom)", amount: null },
  ],
};

// ---- Inputs ----

// Two quotation models: WITH_FOOD charges food per-plate (no hall charge);
// HALL_ONLY charges the hall per hour (no food line). Min 4 hours.
export type FoodMode = "WITH_FOOD" | "HALL_ONLY";
export const MIN_HALL_HOURS = 4;

export interface QuotationInput {
  guestCount: number;
  // "WITH_FOOD" (default) = per-plate food; "HALL_ONLY" = hall charged per hour.
  foodMode?: FoodMode;
  // HALL_ONLY: chosen per-hour rate (one of catalog.hallRates) × hours (min 4).
  hallRate?: number;
  hallHours?: number;
  // Each selection is a catalog id; empty/undefined means "skip this line".
  foodPackageId?: string;
  // Allow a manual per-plate override (e.g. negotiated rate).
  foodPerPlateOverride?: number | null;
  decorId?: string;
  // Activities can be a single pick or several.
  activityIds?: string[];
  cakeId?: string;
  cakeKg?: number;
  photographyId?: string;
  photographyCustomAmount?: number | null;
  drinksPerPerson?: number;
  rooms?: number;
  roomCharge?: number;
  // Free-form extra lines (anything not in the catalog).
  customLines?: { label: string; amount: number }[];
  // 0..100 — applied to the subtotal before tax.
  discountPct?: number;
}

// ---- Output ----

export interface QuoteLine {
  sl: number;
  particulars: string; // category name, e.g. "Food Plan"
  plan: string; // chosen option, e.g. "Veg Gold package (699 × 120)"
  amount: number;
}

export interface PaymentInstallment {
  label: string;
  pct: number;
  amount: number;
  dueHint: string;
}

export interface QuotationResult {
  lines: QuoteLine[];
  subtotal: number; // sum of all lines, before discount
  discountPct: number;
  discountAmount: number;
  taxableAmount: number; // subtotal − discount
  taxRate: number;
  tax: number;
  grandTotal: number;
  paymentSchedule: PaymentInstallment[];
}

const r2 = (n: number) => Math.round(n);

function findById<T extends { id: string }>(arr: T[], id?: string): T | undefined {
  if (!id) return undefined;
  return arr.find((x) => x.id === id);
}

/**
 * The planner's 3-stage payment terms, computed on the grand total:
 *  1. 20% to block the slot (on the booking day)
 *  2. 60% — 15 days before the event
 *  3. Balance (20%) — 2 hours before the event
 * The final installment is computed as the remainder so the three
 * always sum to exactly the grand total (no rounding drift).
 */
export function buildPaymentSchedule(grandTotal: number): PaymentInstallment[] {
  const block = r2(grandTotal * 0.2);
  const mid = r2(grandTotal * 0.6);
  const balance = grandTotal - block - mid;
  return [
    { label: "Booking advance", pct: 20, amount: block, dueHint: "On the day of booking — blocks the slot" },
    { label: "Part payment", pct: 60, amount: mid, dueHint: "15 days before the event" },
    { label: "Final balance", pct: 20, amount: balance, dueHint: "2 hours before the event" },
  ];
}

export function computeQuotation(
  input: QuotationInput,
  catalog: QuoteCatalog = QUOTE_CATALOG
): QuotationResult {
  const guests = Math.max(0, Math.floor(input.guestCount || 0));
  const lines: QuoteLine[] = [];
  let sl = 0;

  // 1. Either Food Plan (per-plate × guests) OR Hall Charges (rate × hours) —
  //    never both. HALL_ONLY replaces the per-plate food line with a hall line.
  if (input.foodMode === "HALL_ONLY") {
    const rate = input.hallRate ?? 0;
    if (rate > 0) {
      const hours = Math.max(MIN_HALL_HOURS, Math.floor(input.hallHours ?? MIN_HALL_HOURS));
      lines.push({
        sl: ++sl,
        particulars: "Hall Charges",
        plan: `Hall (₹${r2(rate)}/hr × ${hours} hr${hours === 1 ? "" : "s"})`,
        amount: r2(rate * hours),
      });
    }
  } else {
    const food = findById(catalog.food, input.foodPackageId);
    if (food) {
      const perPlate =
        input.foodPerPlateOverride != null && input.foodPerPlateOverride >= 0
          ? input.foodPerPlateOverride
          : food.perPlate;
      lines.push({
        sl: ++sl,
        particulars: "Food Plan",
        plan: `${food.label} (₹${r2(perPlate)} × ${guests})`,
        amount: r2(perPlate * guests),
      });
    }
  }

  // 2. Decor Plan = fixed
  const decor = findById(catalog.decor, input.decorId);
  if (decor) {
    lines.push({ sl: ++sl, particulars: "Decor Plan", plan: decor.label, amount: r2(decor.amount) });
  }

  // 3. Activity Plan = fixed (sum of selected)
  const activities = (input.activityIds ?? [])
    .map((id) => findById(catalog.activity, id))
    .filter(Boolean) as FixedItem[];
  if (activities.length) {
    const amt = activities.reduce((s, a) => s + a.amount, 0);
    lines.push({
      sl: ++sl,
      particulars: "Activity Plan",
      plan: activities.map((a) => a.label).join(", "),
      amount: r2(amt),
    });
  }

  // 4. Cake Plan = rate/kg × kg
  const cake = findById(catalog.cake, input.cakeId);
  if (cake && (input.cakeKg ?? 0) > 0) {
    const kg = input.cakeKg as number;
    lines.push({
      sl: ++sl,
      particulars: "Cake Plan",
      plan: `${cake.label} (₹${cake.ratePerKg}/kg × ${kg} kg)`,
      amount: r2(cake.ratePerKg * kg),
    });
  }

  // 5. Photography / Videography = fixed (or custom "other")
  const photo = findById(catalog.photography, input.photographyId);
  if (photo) {
    const amt = photo.amount != null ? photo.amount : input.photographyCustomAmount ?? 0;
    if (amt > 0) {
      lines.push({
        sl: ++sl,
        particulars: "Photography / Videography",
        plan: photo.amount != null ? photo.label : "Custom",
        amount: r2(amt),
      });
    }
  }

  // 6. Drinks Plan = per-person × guest count
  if ((input.drinksPerPerson ?? 0) > 0) {
    const pp = input.drinksPerPerson as number;
    lines.push({
      sl: ++sl,
      particulars: "Drinks Plan",
      plan: `₹${pp} × ${guests}`,
      amount: r2(pp * guests),
    });
  }

  // 7. Accommodation = rooms × room charge
  if ((input.rooms ?? 0) > 0) {
    const rooms = input.rooms as number;
    const charge = input.roomCharge ?? DEFAULT_ROOM_CHARGE;
    lines.push({
      sl: ++sl,
      particulars: "Accommodation (Hotel Rooms)",
      plan: `${rooms} room(s) × ₹${charge}`,
      amount: r2(rooms * charge),
    });
  }

  // Free-form custom lines
  for (const c of input.customLines ?? []) {
    if (c.label?.trim() && Number.isFinite(c.amount) && c.amount !== 0) {
      lines.push({ sl: ++sl, particulars: c.label.trim(), plan: "—", amount: r2(c.amount) });
    }
  }

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const discountPct = Math.min(100, Math.max(0, input.discountPct ?? 0));
  const discountAmount = r2(subtotal * (discountPct / 100));
  const taxableAmount = subtotal - discountAmount;
  const tax = r2(taxableAmount * QUOTE_TAX_RATE);
  const grandTotal = taxableAmount + tax;

  return {
    lines,
    subtotal,
    discountPct,
    discountAmount,
    taxableAmount,
    taxRate: QUOTE_TAX_RATE,
    tax,
    grandTotal,
    paymentSchedule: buildPaymentSchedule(grandTotal),
  };
}

// ---- Validation (UI + server share this) ----
export function validateQuotationInput(i: Partial<QuotationInput>): string[] {
  const errs: string[] = [];
  if (!i.guestCount || i.guestCount < 1) errs.push("Guest count must be at least 1.");
  const hallOnly = i.foodMode === "HALL_ONLY";
  // In hall-only mode a hall rate must be chosen; food package is ignored.
  if (hallOnly && !(i.hallRate && i.hallRate > 0)) {
    errs.push("Select a hall charge (per hour).");
  }
  const hasAnyLine =
    (hallOnly ? !!(i.hallRate && i.hallRate > 0) : !!i.foodPackageId) ||
    i.decorId ||
    (i.activityIds && i.activityIds.length) ||
    (i.cakeId && (i.cakeKg ?? 0) > 0) ||
    i.photographyId ||
    (i.drinksPerPerson ?? 0) > 0 ||
    (i.rooms ?? 0) > 0 ||
    (i.customLines && i.customLines.length);
  if (!hasAnyLine) errs.push("Add at least one line item to the quotation.");
  if (hallOnly && i.hallHours != null && i.hallHours < MIN_HALL_HOURS) {
    errs.push(`Hall booking is a minimum of ${MIN_HALL_HOURS} hours.`);
  }
  if (i.discountPct != null && (i.discountPct < 0 || i.discountPct > 100))
    errs.push("Discount must be between 0 and 100%.");
  // Reject negative / non-finite money inputs (a negative override or rate
  // would otherwise produce negative line totals or a negative grand total).
  const nonNeg = (v: number | null | undefined, label: string) => {
    if (v != null && (!Number.isFinite(v) || v < 0)) errs.push(`${label} cannot be negative.`);
  };
  nonNeg(i.foodPerPlateOverride, "Per-plate price");
  nonNeg(i.hallRate, "Hall rate");
  nonNeg(i.hallHours, "Hall hours");
  nonNeg(i.cakeKg, "Cake quantity");
  nonNeg(i.drinksPerPerson, "Drinks per-person rate");
  nonNeg(i.rooms, "Room count");
  nonNeg(i.roomCharge, "Room charge");
  nonNeg(i.photographyCustomAmount, "Photography amount");
  for (const c of i.customLines ?? []) {
    if (!Number.isFinite(c.amount) || c.amount < 0) errs.push(`Line "${c.label || "custom"}" amount cannot be negative.`);
  }
  return errs;
}
