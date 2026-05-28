// ============================================================
// Invoice calculation — single source of truth for money math
// ============================================================
//
// This logic was previously inlined AND duplicated inside
// createInvoice and updateInvoice in invoice.actions.ts. Duplicated
// money math is dangerous: the two copies can silently drift. It's
// now one pure, tested function used by both.
//
// GST model (India):
//   - Intra-state sale  → CGST + SGST (each typically 9%)
//   - Inter-state sale  → IGST (typically 18%), CGST/SGST = 0
//   The caller signals inter-state by passing igstRate > 0.

export interface InvoiceLineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceCalcInput {
  lineItems: InvoiceLineItemInput[];
  discountPercent?: number | null;
  cgstRate?: number | null;
  sgstRate?: number | null;
  igstRate?: number | null;
}

export interface InvoiceLineItemComputed extends InvoiceLineItemInput {
  amount: number;
  order: number;
}

export interface InvoiceCalcResult {
  lineItems: InvoiceLineItemComputed[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  afterDiscount: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

/** Round to 2 decimal places (paise) — avoids floating-point drift on money. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Compute all invoice money fields from line items, discount, and tax rates.
 * Pure and deterministic — safe to unit-test and reuse anywhere.
 *
 * Defaults match the previous inline behavior: cgst/sgst default to 9%,
 * igst to 0%. When igstRate > 0 the sale is treated as inter-state and
 * CGST/SGST are forced to 0.
 */
export function calculateInvoiceTotals(
  input: InvoiceCalcInput
): InvoiceCalcResult {
  // Line item amounts + subtotal
  let subtotal = 0;
  const lineItems = input.lineItems.map((item, index) => {
    const amount = round2(item.quantity * item.unitPrice);
    subtotal += amount;
    return {
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount,
      order: index,
    };
  });
  subtotal = round2(subtotal);

  // Discount
  const discountPercent = input.discountPercent ?? 0;
  const discountAmount = round2((subtotal * discountPercent) / 100);
  const afterDiscount = round2(subtotal - discountAmount);

  // Tax
  const igstRate = input.igstRate ?? 0;
  const isInterState = igstRate > 0;
  const cgstRate = isInterState ? 0 : input.cgstRate ?? 9;
  const sgstRate = isInterState ? 0 : input.sgstRate ?? 9;

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isInterState) {
    igstAmount = round2((afterDiscount * igstRate) / 100);
  } else {
    cgstAmount = round2((afterDiscount * cgstRate) / 100);
    sgstAmount = round2((afterDiscount * sgstRate) / 100);
  }

  const totalAmount = round2(
    afterDiscount + cgstAmount + sgstAmount + igstAmount
  );

  return {
    lineItems,
    subtotal,
    discountPercent,
    discountAmount,
    afterDiscount,
    cgstRate,
    sgstRate,
    igstRate,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalAmount,
  };
}
