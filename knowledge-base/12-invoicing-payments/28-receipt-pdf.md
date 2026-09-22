# 28 - Receipt PDF & Print Render Engine

---

## 🖨️ Printable Payment Receipt Route

- **Guest API Route**: `/api/guest/receipt/[paymentId]` (`src/app/api/guest/receipt/[paymentId]/route.ts`).
- **Content**: Renders payment receipt header, receipt number (`RCP-YYYY-NNNN`), payment method, transaction ID, invoice number, amount paid, and balance remaining.
