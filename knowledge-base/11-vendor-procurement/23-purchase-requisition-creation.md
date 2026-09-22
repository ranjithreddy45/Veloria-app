# 23 - Purchase Requisition Creation

---

## 📝 PR Creation Flow (`createPurchaseRequisition`)

- **Server Action**: `createPurchaseRequisition(input)` in `src/actions/procurement.actions.ts`.
- **Permission**: Requires `procurement:create` or general write access (`canWrite`).
- **Sequential Numbering**: `allocatePrNumber()` generates `PR-YYYY-NNN` using transaction-safe count retries.
- **Initial Status**: Created in `PENDING` status.
