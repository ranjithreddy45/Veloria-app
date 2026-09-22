# 05 - Invoice Numbering Engine

---

## 🔢 Sequential Number Allocation (`generateInvoiceNumber`)

Invoices use a sequential gapless year format: `INV-YYYY-####` (e.g., `INV-2026-0001`).

```typescript
async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const count = await prisma.invoice.count({
    where: { invoiceNumber: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}
```
