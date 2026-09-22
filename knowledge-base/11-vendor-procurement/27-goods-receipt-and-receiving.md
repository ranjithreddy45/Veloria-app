# 27 - Goods Receipt & Receiving

---

## 📥 Receiving Execution (`markReceived`)

- **Function**: `markReceived(id)` in `src/actions/procurement.actions.ts`.
- **Precondition**: PR status must be `ORDERED`.
- **Atomic Execution**: Inside a single Prisma transaction `$transaction`:
  1. Updates PR status to `RECEIVED` and stamps `receivedAt = new Date()`.
  2. Updates all `PurchaseRequisitionItem` rows setting `received = true`.
  3. Executes `postPurchaseReceivedWithinTx(tx, id, u.id)` for GL accrual.
