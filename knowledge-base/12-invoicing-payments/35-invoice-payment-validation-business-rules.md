# 35 - Validation & Business Rules

---

## 📏 Business Constraints

1. **Line Item Requirement**: Invoices must contain at least one line item (`z.array(invoiceLineItemSchema).min(1)`).
2. **Deterministic Rounding**: All subtotal, tax, and discount amounts are rounded to 2 decimal places using `Math.round((n + EPSILON) * 100) / 100`.
3. **Atomic Single-Credit**: Payment capture uses `updateMany({ status: { not: "COMPLETED" } })` so duplicate browser/webhook calls credit the invoice exactly once.
4. **Gapless Sequential Numbering**: Receipt numbers (`RCP-YYYY-NNNN`) and Invoice numbers (`INV-YYYY-####`) use transactional sequence counters.
