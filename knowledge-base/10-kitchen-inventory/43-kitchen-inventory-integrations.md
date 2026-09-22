# 43 - Kitchen & Inventory External & Internal Integrations

---

## 🔌 System Integrations

1. **PostgreSQL & Prisma ORM**: Relational database persistence for `KitchenPlan`, `InventoryItem`, `PurchaseRequisition`, `MenuItem`.
2. **General Ledger & Accounting**: Financial journal entry creation upon purchase receiving via `postPurchaseReceivedWithinTx()`.
3. **Resend Email API**: Purchase requisition approval emails and vendor purchase order dispatches.
4. **Operations Readiness Engine**: Gate 4 integration evaluating kitchen completion in `computeOperationReadiness()`.
