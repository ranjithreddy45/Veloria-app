// ============================================================
// Finance — Indian statutory tax engine (Rule 3: statutory logic lives
// in a swappable service, because rates change). Pure functions, all
// arithmetic in integer paise (never float). GST place-of-supply split
// (intra-state CGST+SGST vs inter-state IGST) and TDS sections.
// ============================================================

// The entity's home state — Billion Events Hospitality (Veloria Grand),
// Hyderabad, Telangana. GST state code 36. Place-of-supply is compared
// against this to decide intra- vs inter-state.
export const HOME_STATE_CODE = "36"; // Telangana

const toPaise = (rupees: number) => Math.round((rupees ?? 0) * 100);
const toRupees = (paise: number) => paise / 100;

/** Normalise a place-of-supply to a 2-digit GST state code. Accepts a code
 *  ("36", "07") or the leading two digits of a GSTIN ("36ABCDE1234F1Z5"). */
export function stateCodeOf(placeOfSupply?: string | null): string | null {
  if (!placeOfSupply) return null;
  const m = placeOfSupply.trim().match(/^(\d{2})/);
  return m ? m[1] : null;
}

export interface GstSplit {
  taxable: number; // rupees
  ratePct: number; // total GST rate, e.g. 18
  cgst: number; // rupees
  sgst: number; // rupees
  igst: number; // rupees
  total: number; // cgst+sgst+igst, rupees
  interState: boolean;
}

/**
 * Split a taxable amount into CGST/SGST (intra-state) or IGST (inter-state)
 * based on place of supply vs the entity's home state. Rounding is done in
 * paise; for intra-state the half-split rounds CGST and SGST independently so
 * cgst+sgst always reconstructs the total GST exactly.
 */
export function splitGst(args: {
  taxable: number;
  ratePct: number;
  placeOfSupply?: string | null;
  homeStateCode?: string;
}): GstSplit {
  const home = args.homeStateCode ?? HOME_STATE_CODE;
  const posCode = stateCodeOf(args.placeOfSupply) ?? home; // unknown POS → treat as intra-state (conservative for a local venue)
  const interState = posCode !== home;

  const taxablePaise = toPaise(args.taxable);
  const totalTaxPaise = Math.round((taxablePaise * args.ratePct) / 100);

  if (interState) {
    return {
      taxable: args.taxable, ratePct: args.ratePct,
      cgst: 0, sgst: 0, igst: toRupees(totalTaxPaise),
      total: toRupees(totalTaxPaise), interState: true,
    };
  }
  // Intra-state: half each. CGST takes the floor, SGST the remainder, so the
  // two halves always sum back to the exact total (no lost paise).
  const cgstPaise = Math.floor(totalTaxPaise / 2);
  const sgstPaise = totalTaxPaise - cgstPaise;
  return {
    taxable: args.taxable, ratePct: args.ratePct,
    cgst: toRupees(cgstPaise), sgst: toRupees(sgstPaise), igst: 0,
    total: toRupees(totalTaxPaise), interState: false,
  };
}

// ------------------------------------------------------------
// TDS — Tax Deducted at Source. The common sections for a banquet/events
// business paying vendors and professionals. Rates are the standard
// individual/HUF vs others split kept simple to the common case.
// ------------------------------------------------------------
export interface TdsSection {
  code: string;
  label: string;
  ratePct: number; // standard rate
  threshold: number; // annual threshold below which no TDS (rupees); 0 = always
}

export const TDS_SECTIONS: Record<string, TdsSection> = {
  "194C": { code: "194C", label: "Payments to contractors", ratePct: 2, threshold: 30000 },
  "194J": { code: "194J", label: "Professional / technical fees", ratePct: 10, threshold: 30000 },
  "194I": { code: "194I", label: "Rent (plant / building)", ratePct: 10, threshold: 240000 },
  "194H": { code: "194H", label: "Commission or brokerage", ratePct: 5, threshold: 15000 },
  "194Q": { code: "194Q", label: "Purchase of goods", ratePct: 0.1, threshold: 5000000 },
};

export interface TdsResult {
  section: string;
  ratePct: number;
  base: number; // rupees
  tds: number; // rupees (deducted)
  applied: boolean; // false when below threshold
}

/**
 * Compute TDS for a single payment under a section. `cumulativeForYear` lets the
 * caller pass the running annual total to the same payee so the threshold is
 * evaluated correctly; pass the payment amount alone for a per-bill check.
 */
export function computeTds(args: {
  section: string;
  amount: number; // taxable base, rupees
  cumulativeForYear?: number;
}): TdsResult {
  const s = TDS_SECTIONS[args.section];
  if (!s) throw new Error(`Unknown TDS section: ${args.section}`);
  const cumulative = args.cumulativeForYear ?? args.amount;
  const applied = s.threshold === 0 || cumulative > s.threshold;
  const tdsPaise = applied ? Math.round((toPaise(args.amount) * s.ratePct) / 100) : 0;
  return { section: s.code, ratePct: s.ratePct, base: args.amount, tds: toRupees(tdsPaise), applied };
}
