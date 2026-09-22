# 27 - Invoice PDF & Print Render Engine

---

## 🖨️ Printable HTML Invoice Route

- **Print Route**: `/(print)/invoices/[invoiceId]/pdf` (`src/app/(print)/invoices/[invoiceId]/pdf/page.tsx`).
- **Guest API Route**: `/api/guest/invoice/[invoiceId]` (`src/app/api/guest/invoice/[invoiceId]/route.ts`).
- **Technology**: Native SSR HTML template with print CSS media queries `@media print`, rendering Tax Invoice tables without headless browser overhead.
