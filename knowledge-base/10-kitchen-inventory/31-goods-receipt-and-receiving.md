# 31 - Goods Receipt & Stock Receiving

---

## 📥 Goods Receiving Mechanics (`markReceived`)

```typescript
// CODE VERIFIED: src/actions/procurement.actions.ts
export async function markReceived(id: string): Promise<Result<{ id: string }>> {
  // Validates transition PENDING/ORDERED -> RECEIVED
  // Updates PurchaseRequisition.status = RECEIVED
  // Calls postPurchaseReceivedWithinTx() to generate GL journal entry
}
```

- **Line Item Receiving**: Individual items in `PurchaseRequisitionItem` update `received = true`.
