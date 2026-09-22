# 20 - Receipts Engine

---

## 🧾 Monotonic Receipt Allocation (`allocateReceiptNumber`)

- **Receipt Format**: `RCP-YYYY-NNNN` (e.g., `RCP-2026-0042`).
- **Atomic Counter**: `FinSequence` table allocates receipt numbers sequentially across both online and offline payment paths.
- **Customer Notice**: `notifyCustomerOfPayment()` dispatches in-app and email notifications with receipt numbers.
