// ============================================================
// Which tax rate applies to this quotation?
//
// Three outcomes, and keeping them distinct is the whole point:
//
//   AUTO      one usable slab — apply it, say nothing
//   CHOSEN    several slabs and someone picked one
//   MUST_ASK  several slabs and nobody has picked
//   NONE      the property has no slabs configured
//
// MUST_ASK is what blocks a quotation from going for approval. The failure this
// prevents is quiet and expensive: a quote sent at the wrong rate is a number a
// customer has already agreed to, and correcting it afterwards means reissuing
// the quote or absorbing the difference.
//
// Pure — no database, no session. The rules are worth testing exhaustively and
// they cannot be while tangled up with Prisma.
// ============================================================

export interface TaxSlabLike {
  id: string;
  name: string;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  isDefault: boolean;
  isActive: boolean;
}

export type TaxResolution =
  | { kind: "AUTO"; slab: TaxSlabLike }
  | { kind: "CHOSEN"; slab: TaxSlabLike }
  | { kind: "MUST_ASK"; options: TaxSlabLike[] }
  | { kind: "NONE" };

/**
 * Decide the tax slab for a quotation.
 *
 * `chosenId` is whatever the quotation currently has stored.
 */
export function resolveTaxSlab(
  slabs: TaxSlabLike[],
  chosenId?: string | null
): TaxResolution {
  // Only active slabs are offerable. An inactive slab already attached to a
  // quotation still resolves below, so retiring a rate never rewrites history.
  const usable = slabs.filter((s) => s.isActive);

  if (chosenId) {
    // Look in the FULL list, not just active ones: a quote raised last month
    // under a since-retired rate must keep showing that rate.
    const picked = slabs.find((s) => s.id === chosenId);
    if (picked) return { kind: "CHOSEN", slab: picked };
    // The stored slab is gone entirely (deleted with its venue, say). Fall
    // through rather than pretending — better to re-ask than to invent a rate.
  }

  if (usable.length === 0) return { kind: "NONE" };
  if (usable.length === 1) return { kind: "AUTO", slab: usable[0] };

  // Several slabs. A default resolves it without a prompt — that is what
  // marking one default is FOR. Two defaults is a misconfiguration, and
  // silently picking the first would hide it, so it falls through to asking.
  const defaults = usable.filter((s) => s.isDefault);
  if (defaults.length === 1) return { kind: "AUTO", slab: defaults[0] };

  return { kind: "MUST_ASK", options: usable };
}

/** True when a quotation in this state must not go for approval yet. */
export function blocksApproval(res: TaxResolution): boolean {
  return res.kind === "MUST_ASK";
}

/** The combined percentage, for display. */
export function totalRate(slab: TaxSlabLike): number {
  return (
    Number(slab.cgstRate || 0) + Number(slab.sgstRate || 0) + Number(slab.igstRate || 0)
  );
}

export interface TaxBreakdown {
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

/**
 * Tax on a subtotal, split the way a GST invoice has to show it.
 *
 * Each component is rounded to paise INDEPENDENTLY and the total is their sum,
 * rather than rounding a single combined figure and splitting it afterwards.
 * That matters because the invoice prints all three lines: if the parts were
 * derived from a rounded whole they would not add back up to it, and an invoice
 * whose components disagree with its total is one a customer or an auditor will
 * reject.
 */
export function computeTax(subtotal: number, slab: TaxSlabLike): TaxBreakdown {
  const base = Number(subtotal) || 0;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const cgst = r2((base * Number(slab.cgstRate || 0)) / 100);
  const sgst = r2((base * Number(slab.sgstRate || 0)) / 100);
  const igst = r2((base * Number(slab.igstRate || 0)) / 100);
  return { cgst, sgst, igst, total: r2(cgst + sgst + igst) };
}
