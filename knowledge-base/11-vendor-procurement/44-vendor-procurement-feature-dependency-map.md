# 44 - Vendor Procurement Feature Dependency Map

---

## 🔗 Feature Dependency Matrix

| Feature | Depends On | Required By | Status |
|---|---|---|---|
| **Vendor Master** | Prisma Schema (`Vendor`) | Booking Assignment, Work Orders, Vendor Portal | `AUTOMATIC` |
| **Vendor Portal** | NextAuth v5, `User (role: VENDOR)` | Vendor Event Confirmation, Bidding | `AUTOMATIC` |
| **Work Order Signing** | `WorkOrder`, `isSafeReceiptUrl` | Advance Payment Release | `AUTOMATIC` |
| **PR Receiving GL Post** | `PurchaseRequisition`, `FinJournalEntry` | General Ledger Accounts Payable | `AUTOMATIC` |
| **Vendor Bill Accrual** | `VendorBill`, `FinAccount (5010-5230, 2100)` | Financial Payout Settlement | `AUTOMATIC` |
