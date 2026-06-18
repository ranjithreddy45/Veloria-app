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
  food: FoodPackage[];
  decor: FixedItem[];
  activity: FixedItem[];
  cake: CakeOption[];
  // `amount: null` means "other" — the user types a custom amount.
  photography: { id: string; label: string; amount: number | null }[];
}

export const QUOTE_CATALOG: QuoteCatalog = {
  timeSlots: ["11am to 3pm", "5pm to 10pm", "Full Day"],
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
    { id: "babyshower_premium", label: "Baby shower premium", amount: 25000 },
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

export interface QuotationInput {
  guestCount: number;
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

  // 1. Food Plan = per-plate × guest count
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

  return finalizeQuote(lines, input.discountPct ?? 0);
}

// Shared tail: subtotal → discount → tax → grand total → payment schedule.
// Used by BOTH the legacy computeQuotation and the catalog-driven path so the
// money math is defined in exactly one place.
export function finalizeQuote(lines: QuoteLine[], discountPctRaw: number): QuotationResult {
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const discountPct = Math.min(100, Math.max(0, discountPctRaw ?? 0));
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

// ============================================================
// Catalog-driven quotation (DB QuotePackages). Pure — the caller resolves the
// chosen packages from the DB and passes them in (keeps this lib server/client
// safe with no Prisma import).
// ============================================================
export type CatalogPricing = "PER_PLATE" | "PER_PERSON" | "PER_NIGHT" | "PER_KG" | "FLAT";

export interface CatalogPackage {
  id: string;
  category: string; // HALL | FOOD | DECOR | CAKE | DRINKS | ACTIVITY | ROOM | PHOTOGRAPHY
  name: string;
  pricingType: CatalogPricing;
  price: number;
  unitLabel?: string | null;
  menuItems: { id: string; name: string; extraCost: number }[];
}

export interface CatalogSelection {
  packageId: string;
  lockedMenuItemIds: string[];
  kg?: number; // for PER_KG (cake)
}

export interface CatalogQuoteInput {
  guestCount: number;
  rooms?: number;
  nights?: number; // derived from check-in/check-out
  discountPct?: number;
  selections: CatalogSelection[];
  customItems?: { label: string; amount: number }[];
}

const CATEGORY_PARTICULARS: Record<string, string> = {
  HALL: "Hall / Venue",
  FOOD: "Food Plan",
  DECOR: "Decor Plan",
  CAKE: "Cake Plan",
  DRINKS: "Drinks Plan",
  ACTIVITY: "Activity Plan",
  ROOM: "Accommodation (Hotel Rooms)",
  PHOTOGRAPHY: "Photography / Videography",
};

export function computeCatalogQuote(
  input: CatalogQuoteInput,
  packagesById: Map<string, CatalogPackage>
): QuotationResult {
  const guests = Math.max(0, Math.floor(input.guestCount || 0));
  const rooms = Math.max(0, Math.floor(input.rooms || 0));
  const nights = Math.max(0, Math.floor(input.nights || 0));
  const lines: QuoteLine[] = [];
  let sl = 0;

  for (const sel of input.selections ?? []) {
    const pkg = packagesById.get(sel.packageId);
    if (!pkg) continue;

    let multiplier = 1;
    let unit = "";
    switch (pkg.pricingType) {
      case "PER_PLATE":
      case "PER_PERSON":
        multiplier = guests;
        unit = `₹${r2(pkg.price)} × ${guests}`;
        break;
      case "PER_NIGHT":
        multiplier = rooms * nights;
        unit = `₹${r2(pkg.price)} × ${rooms} room(s) × ${nights} night(s)`;
        break;
      case "PER_KG":
        multiplier = Math.max(0, sel.kg ?? 0);
        unit = `₹${r2(pkg.price)}/kg × ${multiplier} kg`;
        break;
      case "FLAT":
      default:
        multiplier = 1;
        unit = "";
    }

    const locked = (pkg.menuItems ?? []).filter((m) => sel.lockedMenuItemIds?.includes(m.id));
    const lockedExtra = locked.reduce((s, m) => s + (m.extraCost || 0), 0);
    const amount = r2(pkg.price * multiplier + lockedExtra);
    if (amount <= 0 && pkg.pricingType !== "FLAT") continue;

    const chosen = locked.length ? ` — ${locked.map((m) => m.name).join(", ")}` : "";
    lines.push({
      sl: ++sl,
      particulars: CATEGORY_PARTICULARS[pkg.category] ?? pkg.category,
      plan: `${pkg.name}${unit ? ` (${unit})` : ""}${chosen}`,
      amount,
    });
  }

  // Custom items (anything not in the catalog).
  for (const c of input.customItems ?? []) {
    if (c.label?.trim() && Number.isFinite(c.amount) && c.amount !== 0) {
      lines.push({ sl: ++sl, particulars: c.label.trim(), plan: "Custom", amount: r2(c.amount) });
    }
  }

  return finalizeQuote(lines, input.discountPct ?? 0);
}

// ============================================================
// Unified stored-quote shape. A quotation's inputsJson is EITHER the legacy
// QuotationInput OR a catalog snapshot ({mode:"catalog"} with the resolved
// packages frozen in, so totals never drift if the catalog is edited later).
// One compute/validate branches on it, so the detail view, PDF, headline,
// submit-validation and booking-invoice all stay agnostic to how it was built.
// ============================================================
export interface CatalogStoredInput {
  mode: "catalog";
  catalog: CatalogQuoteInput;
  packages: CatalogPackage[]; // frozen snapshot of the chosen packages
  // carried for display/booking (mirrors legacy fields)
  checkInDate?: string | null;
  checkOutDate?: string | null;
}
export type StoredQuoteInput = QuotationInput | CatalogStoredInput;

function isCatalog(v: StoredQuoteInput): v is CatalogStoredInput {
  return (v as CatalogStoredInput)?.mode === "catalog";
}

export function computeStoredQuote(stored: StoredQuoteInput): QuotationResult {
  if (isCatalog(stored)) {
    const map = new Map((stored.packages ?? []).map((p) => [p.id, p]));
    return computeCatalogQuote(stored.catalog, map);
  }
  return computeQuotation(stored as QuotationInput);
}

export function validateStoredQuote(stored: StoredQuoteInput): string[] {
  if (isCatalog(stored)) {
    const errs: string[] = [];
    const c = stored.catalog;
    if (!c || (c.guestCount ?? 0) < 1) errs.push("Guest count must be at least 1.");
    const hasSel = (c?.selections ?? []).length > 0;
    const hasCustom = (c?.customItems ?? []).some((i) => i.label?.trim() && i.amount);
    if (!hasSel && !hasCustom) errs.push("Add at least one package or custom item.");
    return errs;
  }
  return validateQuotationInput(stored as QuotationInput);
}

/** Whole nights between two ISO dates (checkout − checkin), min 0. */
export function nightsBetween(checkIn?: string | null, checkOut?: string | null): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(checkIn);
  const b = new Date(checkOut);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
  return Math.max(0, diff);
}

// ---- Validation (UI + server share this) ----
export function validateQuotationInput(i: Partial<QuotationInput>): string[] {
  const errs: string[] = [];
  if (!i.guestCount || i.guestCount < 1) errs.push("Guest count must be at least 1.");
  const hasAnyLine =
    i.foodPackageId ||
    i.decorId ||
    (i.activityIds && i.activityIds.length) ||
    (i.cakeId && (i.cakeKg ?? 0) > 0) ||
    i.photographyId ||
    (i.drinksPerPerson ?? 0) > 0 ||
    (i.rooms ?? 0) > 0 ||
    (i.customLines && i.customLines.length);
  if (!hasAnyLine) errs.push("Add at least one line item to the quotation.");
  if (i.discountPct != null && (i.discountPct < 0 || i.discountPct > 100))
    errs.push("Discount must be between 0 and 100%.");
  // Reject negative / non-finite money inputs (a negative override or rate
  // would otherwise produce negative line totals or a negative grand total).
  const nonNeg = (v: number | null | undefined, label: string) => {
    if (v != null && (!Number.isFinite(v) || v < 0)) errs.push(`${label} cannot be negative.`);
  };
  nonNeg(i.foodPerPlateOverride, "Per-plate price");
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
