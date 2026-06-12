// ============================================================
// Projects CRM — CapEx (capital-expenditure) budget calculator.
// Pure engine + editable default rate card for readying a banquet venue to
// Veloria Grand luxury standards. Same pattern as the BD projection / sales
// quotation engines: ONE source of truth that the live UI preview and the
// server snapshot/PDF both import, so the owner-facing budget can't drift.
// Default rates are India ballpark figures and are fully editable per-line.
// ============================================================

export type CapexBasis = "AREA" | "UNIT" | "LUMPSUM";

export interface CapexCategory {
  key: string;
  label: string;
  basis: CapexBasis; // AREA = rate × sq-ft; UNIT = rate × qty; LUMPSUM = flat amount
  defaultRate: number; // ₹ per sq-ft (AREA), per unit (UNIT), or flat (LUMPSUM)
  unitLabel: string;
  note: string;
}

// Editable defaults — the team can override any rate/qty per project.
export const CAPEX_CATEGORIES: CapexCategory[] = [
  { key: "civil_interiors", label: "Civil & Interiors", basis: "AREA", defaultRate: 1400, unitLabel: "per sq ft", note: "Structural repairs, partitions, paneling, premium interior finishes (carpet-area build-out)." },
  { key: "false_ceiling", label: "False Ceiling", basis: "AREA", defaultRate: 220, unitLabel: "per sq ft", note: "Gypsum/POP multi-level coves, GI framing, fire-rated boards near service areas." },
  { key: "bathrooms_washrooms", label: "Bathrooms / Washrooms", basis: "UNIT", defaultRate: 350000, unitLabel: "per washroom block", note: "Luxury washroom block (8–12 fixtures): imported sanitaryware, vanities, sensor taps. Accessible WC mandatory." },
  { key: "flooring_carpet", label: "Flooring & Carpet", basis: "AREA", defaultRate: 350, unitLabel: "per sq ft", note: "Italian marble / large vitrified in lobby; wall-to-wall carpet or wooden flooring in hall (blended)." },
  { key: "painting", label: "Painting", basis: "AREA", defaultRate: 65, unitLabel: "per sq ft", note: "Premium emulsion, texture/metallic accents, anti-fungal treatment (per painted surface area)." },
  { key: "electrical_wiring", label: "Electrical & Wiring", basis: "AREA", defaultRate: 280, unitLabel: "per sq ft", note: "Concealed FR copper wiring, DBs, MCB/RCCB, earthing, DG changeover, load provisioning." },
  { key: "lighting", label: "Lighting (ambient + decorative)", basis: "AREA", defaultRate: 220, unitLabel: "per sq ft", note: "Layered LED, cove/profile, DMX-dimmable scenes; signature chandeliers budgeted on top." },
  { key: "hvac_airconditioning", label: "HVAC / Air-conditioning", basis: "AREA", defaultRate: 1600, unitLabel: "per sq ft", note: "Centralized VRV/VRF or ducted ~1 TR per 100–120 sq-ft for packed banquet loads + BMS." },
  { key: "furniture", label: "Furniture (chairs / tables / sofas)", basis: "UNIT", defaultRate: 2200, unitLabel: "per guest seat", note: "Per-guest blended: banquet/Chiavari chair + share of tables, lounge & stage furniture." },
  { key: "fire_safety", label: "Fire Safety", basis: "AREA", defaultRate: 160, unitLabel: "per sq ft", note: "Sprinklers, detectors, addressable alarm panel, hydrants, exit signage — NBC 2016 / Fire NOC." },
  { key: "lift_elevator", label: "Lift / Elevator", basis: "UNIT", defaultRate: 2800000, unitLabel: "per lift", note: "Premium passenger lift (13–20 pax) with luxury cabin + shaft fit-out + AMC start." },
  { key: "landscaping_exterior_entrance", label: "Landscaping / Exterior & Entrance", basis: "LUMPSUM", defaultRate: 4500000, unitLabel: "per venue", note: "Porte-cochere, facade, driveway, valet drop-off, water feature, lawn, outdoor lighting." },
  { key: "av_systems", label: "AV (sound + projector + screens)", basis: "LUMPSUM", defaultRate: 3500000, unitLabel: "per hall", note: "Line-array PA, digital mixer, wireless mics, LED wall / laser projector + screens + control." },
  { key: "branding_signage", label: "Branding / Signage", basis: "LUMPSUM", defaultRate: 1200000, unitLabel: "per venue", note: "Backlit/3D facade logo, hall nameplates, wayfinding, welcome screens, brand photo wall." },
];

export const DEFAULT_CONTINGENCY_PCT = 12;

export const CAPEX_CATEGORY_BY_KEY: Record<string, CapexCategory> = Object.fromEntries(
  CAPEX_CATEGORIES.map((c) => [c.key, c])
);

export interface CapexLineInput {
  key: string;
  included: boolean;
  rate?: number; // override the default rate
  qty?: number; // AREA → sq-ft for this line; UNIT → number of units; LUMPSUM → ignored
}

export interface CapexInput {
  builtUpAreaSqft: number; // default area used for AREA lines
  guestSeats: number; // default qty for per-seat furniture
  contingencyPct?: number;
  weeks?: number; // estimated timeline override (weeks)
  lines: CapexLineInput[];
}

export interface CapexResultLine {
  key: string;
  label: string;
  basis: CapexBasis;
  rate: number;
  qty: number;
  unitLabel: string;
  amount: number;
}

export interface CapexResult {
  lines: CapexResultLine[];
  subtotal: number;
  contingencyPct: number;
  contingencyAmount: number;
  total: number;
  estimatedWeeks: number;
}

const r0 = (n: number) => Math.round(n);

// Default timeline heuristic when the user hasn't set one: a base mobilisation
// plus a sq-ft-driven term, nudged up for big-ticket budgets.
export function estimateWeeks(areaSqft: number, total: number): number {
  const base = 6;
  const areaTerm = Math.ceil(Math.max(0, areaSqft) / 1500);
  const sizeTerm = total > 30_000_000 ? 8 : total > 10_000_000 ? 4 : 0;
  return Math.max(8, base + areaTerm + sizeTerm);
}

export function computeCapex(
  input: CapexInput,
  categories: CapexCategory[] = CAPEX_CATEGORIES
): CapexResult {
  const area = Math.max(0, input.builtUpAreaSqft || 0);
  const seats = Math.max(0, input.guestSeats || 0);
  const byKey = new Map(input.lines.map((l) => [l.key, l]));

  const lines: CapexResultLine[] = [];
  for (const cat of categories) {
    const line = byKey.get(cat.key);
    if (!line || !line.included) continue;
    const rate = line.rate != null && line.rate >= 0 ? line.rate : cat.defaultRate;

    let qty: number;
    let amount: number;
    if (cat.basis === "AREA") {
      qty = line.qty != null && line.qty >= 0 ? line.qty : area;
      amount = r0(rate * qty);
    } else if (cat.basis === "UNIT") {
      const def = cat.key === "furniture" ? seats : 1;
      qty = line.qty != null && line.qty >= 0 ? line.qty : def;
      amount = r0(rate * qty);
    } else {
      // LUMPSUM — the rate IS the flat amount; qty is 1.
      qty = 1;
      amount = r0(rate);
    }
    lines.push({ key: cat.key, label: cat.label, basis: cat.basis, rate, qty, unitLabel: cat.unitLabel, amount });
  }

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const contingencyPct = Math.min(100, Math.max(0, input.contingencyPct ?? DEFAULT_CONTINGENCY_PCT));
  const contingencyAmount = r0(subtotal * (contingencyPct / 100));
  const total = subtotal + contingencyAmount;
  const estimatedWeeks =
    input.weeks != null && input.weeks > 0 ? Math.round(input.weeks) : estimateWeeks(area, total);

  return { lines, subtotal, contingencyPct, contingencyAmount, total, estimatedWeeks };
}

export function validateCapexInput(i: Partial<CapexInput>): string[] {
  const errs: string[] = [];
  if (!i.builtUpAreaSqft || i.builtUpAreaSqft < 1) errs.push("Built-up area (sq ft) is required.");
  const included = (i.lines ?? []).filter((l) => l.included);
  if (!included.length) errs.push("Include at least one CapEx category.");
  for (const l of i.lines ?? []) {
    if (l.rate != null && (!Number.isFinite(l.rate) || l.rate < 0)) errs.push(`Rate for "${l.key}" cannot be negative.`);
    if (l.qty != null && (!Number.isFinite(l.qty) || l.qty < 0)) errs.push(`Quantity for "${l.key}" cannot be negative.`);
  }
  if (i.contingencyPct != null && (i.contingencyPct < 0 || i.contingencyPct > 100))
    errs.push("Contingency must be 0–100%.");
  return errs;
}

// A sensible starting input: every category included at its default rate.
export function defaultCapexInput(builtUpAreaSqft = 5000, guestSeats = 300): CapexInput {
  return {
    builtUpAreaSqft,
    guestSeats,
    contingencyPct: DEFAULT_CONTINGENCY_PCT,
    lines: CAPEX_CATEGORIES.map((c) => ({ key: c.key, included: true })),
  };
}
