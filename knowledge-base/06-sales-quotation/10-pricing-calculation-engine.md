# Pricing Calculation Engine Architecture

## Overview

The core pricing calculation engine (`src/lib/sales/quotation-calc.ts` & `src/lib/pricing/yield-engine.ts`) evaluates base per-plate charges, guest counts, demand multipliers, itemized add-ons, discounts, and GST tax slabs.

---

## Calculation Order Pipeline

```
Base Charge (Per Plate * Guest Count)
  + Add-Ons Subtotal (QuoteLineItems)
  = Raw Base Subtotal
  x Date Demand Multiplier (PricingRule / DemandPricingConfig)
  = Adjusted Subtotal
  - Discount Amount (discountPct or Manual Override)
  = Net Taxable Value
  + GST Tax (18% via VenueTaxSlab)
  = Grand Total (grandTotal)
```

---

## Code References

- `src/lib/sales/quotation-calc.ts`: Subtotal, GST, and net total calculation functions.
- `src/lib/pricing/yield-engine.ts`: Demand multiplier application.
