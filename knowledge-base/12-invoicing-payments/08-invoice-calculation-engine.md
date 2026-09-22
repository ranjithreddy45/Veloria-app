# 08 - Invoice Calculation Engine

---

## 🧮 Money Math Functions (`src/lib/invoice-calc.ts`)

`calculateInvoiceTotals()` serves as the single source of truth for invoice math:

```typescript
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Subtotal calculation
let subtotal = 0;
lineItems.forEach(item => {
  item.amount = round2(item.quantity * item.unitPrice);
  subtotal += item.amount;
});

// Discount application
const discountAmount = round2((subtotal * discountPercent) / 100);
const afterDiscount = round2(subtotal - discountAmount);

// Tax calculation (Intra-state vs Inter-state)
if (igstRate > 0) {
  igstAmount = round2((afterDiscount * igstRate) / 100);
} else {
  cgstAmount = round2((afterDiscount * cgstRate) / 100);
  sgstAmount = round2((afterDiscount * sgstRate) / 100);
}

const totalAmount = round2(afterDiscount + cgstAmount + sgstAmount + igstAmount);
```
