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

// ---- Vendor-package line items (Vendor Module spec, parts 4–5) ----
// A quote can carry any number of vendor-package lines (repeatable, multiple
// per category). Each line pins the customer-facing unit price + qty and an
// OPTIONAL per-line discount (percentage OR flat amount). The package's own
// caps (minPax, maxDiscountValue/Type) are enforced in the UI and re-checked
// server-side against the DB — they are NOT trusted from this shape.
export type PackageDiscountType = "PERCENT" | "AMOUNT";

export interface PackageLine {
  /** Client-side row id (stable key for the repeatable list); optional. */
  id?: string;
  vendorPackageId: string;
  name: string;
  category: string;
  /** Catalog customer-facing unit price (VendorPackage.customerPrice ?? price) — the reference. */
  unitPrice: number;
  /**
   * Optional sales-entered REVISED unit price (negotiated). When set (>0) it is the
   * authoritative unit for this line, replacing the catalog price. A mark-UP is
   * always allowed; a mark-DOWN below the catalog is treated as a discount and is
   * capped server-side by the package's maxDiscount floor (anti-forgery preserved).
   */
  revisedUnitPrice?: number;
  /** pax / units for this line. */
  qty: number;
  /** The package's minimum pax (copied in for UI + validation). */
  minPax?: number;
  /** Per-line discount kind + value (capped by the package's maxDiscount*). */
  discountType?: PackageDiscountType;
  discountValue?: number;
}

/** Customer-facing DTO for a selectable vendor package (see getQuotePackageOptions). */
export interface QuotePackageOption {
  id: string;
  name: string;
  category: string;
  vendorName: string;
  /** customerPrice ?? price, as a plain number. */
  customerPrice: number;
  minPax: number | null;
  maxDiscountType: string | null;
  maxDiscountValue: number | null;
  priceUnit: string;
}

/**
 * Net amount for one vendor-package line: gross = unitPrice × qty, then a
 * per-line discount (PERCENT of gross, or a flat AMOUNT capped at the gross).
 * Returns both the net line amount and the discount that was applied.
 */
export function computePackageLine(line: PackageLine): { gross: number; lineDiscount: number; amount: number } {
  const qty = Math.max(0, Math.floor(line.qty || 0));
  // A revised (negotiated) unit price, when set, is authoritative for this line.
  const revised = Number.isFinite(line.revisedUnitPrice) && (line.revisedUnitPrice ?? 0) > 0 ? (line.revisedUnitPrice as number) : null;
  const catalog = Number.isFinite(line.unitPrice) && line.unitPrice > 0 ? line.unitPrice : 0;
  const unit = revised ?? catalog;
  const gross = r2(unit * qty);
  let lineDiscount = 0;
  const val = line.discountValue ?? 0;
  if (val > 0) {
    if (line.discountType === "AMOUNT") {
      lineDiscount = Math.min(r2(val), gross);
    } else if (line.discountType === "PERCENT") {
      lineDiscount = r2(gross * (Math.min(100, val) / 100));
    }
  }
  return { gross, lineDiscount, amount: gross - lineDiscount };
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
  // Vendor-package line items (repeatable, multiple per category allowed).
  // Each nets its own per-line discount; the net amounts add into the subtotal
  // BEFORE the global discountPct + tax. Empty/undefined = byte-identical today.
  packageLines?: PackageLine[];
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
  subtotal: number; // sum of all lines (package lines already net of per-line discount), before global discount
  discountPct: number;
  discountAmount: number;
  // Sum of the per-line vendor-package discounts folded into the line amounts
  // above (0 when there are no package lines). Informational — the subtotal is
  // already net of these; the global discount is separate (discountAmount).
  lineDiscountsTotal: number;
  taxableAmount: number; // subtotal − global discount
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
 * THE canonical payment terms — 30 / 50 / 20.
 *  1. 30% advance (on the booking day, blocks the slot)
 *  2. 50% — 15 days before the event
 *  3. 20% — 48 hours before the event
 *
 * Everything that quotes, invoices or renders the schedule reads THIS constant.
 * It is exported so the invoice installment planner and the PDF/print templates
 * cannot drift from the quote the customer accepted — a mismatch here is a
 * money bug, not a copy bug.
 *
 * `daysBeforeEvent` is what the invoice scheduler anchors due dates on (48 hours
 * = 2 days), so the timing lives beside the percentage rather than being
 * re-derived per call site.
 */
export const PAYMENT_TERMS = [
  { label: "Booking advance", pct: 30, dueHint: "On the day of booking — blocks the slot", daysBeforeEvent: null },
  { label: "Part payment", pct: 50, dueHint: "15 days before the event", daysBeforeEvent: 15 },
  { label: "Final balance", pct: 20, dueHint: "48 hours before the event", daysBeforeEvent: 2 },
] as const;

/** "30 / 50 / 20" — for headings and help text, derived so it can't go stale. */
export const PAYMENT_TERMS_LABEL = PAYMENT_TERMS.map((t) => t.pct).join(" / ");

/**
 * The customer-facing terms sentence printed on invoices and quotes. Derived from
 * PAYMENT_TERMS so the wording on the document can never contradict the
 * installment plan actually raised against it.
 */
export const PAYMENT_TERMS_SENTENCE = `Payment terms: ${PAYMENT_TERMS.map(
  (t) => `${t.pct}% ${t.daysBeforeEvent == null ? "to block the slot" : t.dueHint.toLowerCase()}`
).join(", ")}.`;

/**
 * Due date for one installment, given the event date. `daysBeforeEvent === null`
 * means due immediately (the advance). Without an event date, `fallbackDays`
 * keeps the dates strictly increasing so the plan still validates.
 */
export function installmentDueDate(
  daysBeforeEvent: number | null,
  eventDate: Date | null,
  fallbackDays: number
): Date {
  if (daysBeforeEvent == null) return new Date();
  if (!eventDate) return new Date(Date.now() + fallbackDays * 86_400_000);
  const d = new Date(eventDate);
  d.setDate(d.getDate() - daysBeforeEvent);
  return d;
}

/**
 * Splits a grand total across PAYMENT_TERMS. The LAST installment is the
 * remainder so the parts always sum to exactly the grand total (no rounding
 * drift leaving a stray rupee uncollectable).
 */
export function buildPaymentSchedule(grandTotal: number): PaymentInstallment[] {
  const out: PaymentInstallment[] = [];
  let allocated = 0;
  PAYMENT_TERMS.forEach((term, idx) => {
    const isLast = idx === PAYMENT_TERMS.length - 1;
    const amount = isLast ? grandTotal - allocated : r2(grandTotal * (term.pct / 100));
    allocated += amount;
    out.push({ label: term.label, pct: term.pct, amount, dueHint: term.dueHint });
  });
  return out;
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

  // Vendor-package lines (repeatable, multiple-per-category). Each nets its own
  // per-line discount; the NET amount flows into the subtotal like any other
  // line, before the global discount + tax. Empty/undefined = no-op (identical).
  let lineDiscountsTotal = 0;
  for (const p of input.packageLines ?? []) {
    if (!p || !p.vendorPackageId) continue;
    const qty = Math.max(0, Math.floor(p.qty || 0));
    if (qty <= 0) continue;
    const { lineDiscount, amount } = computePackageLine(p);
    lineDiscountsTotal += lineDiscount;
    const label = p.name?.trim() || "Vendor package";
    const cat = p.category?.trim();
    const discNote =
      lineDiscount > 0
        ? p.discountType === "PERCENT"
          ? ` − ${Math.min(100, p.discountValue ?? 0)}%`
          : ` − ₹${r2(lineDiscount)}`
        : "";
    // Show the AUTHORITATIVE unit price the amount is computed off (revised when
    // set, else catalog) so the printed "₹unit × qty" reconciles with the line total.
    const revisedUnit =
      Number.isFinite(p.revisedUnitPrice) && (p.revisedUnitPrice ?? 0) > 0 ? (p.revisedUnitPrice as number) : null;
    const shownUnit = revisedUnit ?? (p.unitPrice > 0 ? p.unitPrice : 0);
    lines.push({
      sl: ++sl,
      particulars: cat ? `${cat}: ${label}` : label,
      plan: `₹${r2(shownUnit)} × ${qty}${discNote}`,
      amount,
    });
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
    lineDiscountsTotal,
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
    (i.customLines && i.customLines.length) ||
    (i.packageLines && i.packageLines.length);
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
  // Vendor-package lines: qty (≥ minPax), non-negative unit price, and a
  // per-line discount within self-consistent bounds. The package's DB-authoritative
  // maxDiscount cap is re-checked server-side (validatePackageLinesAgainstCatalog).
  for (const p of i.packageLines ?? []) {
    if (!p?.vendorPackageId) continue;
    const label = p.name?.trim() || "package";
    const qty = Math.floor(p.qty ?? 0);
    if (!Number.isFinite(p.qty) || qty < 1) {
      errs.push(`Package "${label}" needs a quantity of at least 1.`);
    } else if (p.minPax != null && qty < p.minPax) {
      errs.push(`Package "${label}" requires a minimum of ${p.minPax} pax/units.`);
    }
    if (p.unitPrice != null && (!Number.isFinite(p.unitPrice) || p.unitPrice < 0)) {
      errs.push(`Package "${label}" unit price cannot be negative.`);
    }
    if (p.discountValue != null) {
      if (!Number.isFinite(p.discountValue) || p.discountValue < 0) {
        errs.push(`Package "${label}" discount cannot be negative.`);
      } else if (p.discountType === "PERCENT" && p.discountValue > 100) {
        errs.push(`Package "${label}" percentage discount cannot exceed 100%.`);
      }
    }
  }
  return errs;
}
