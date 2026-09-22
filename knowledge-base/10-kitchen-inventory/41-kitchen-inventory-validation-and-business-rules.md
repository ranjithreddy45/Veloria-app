# 41 - Kitchen & Inventory Validation & Business Rules

---

## 🛑 Validation Safeguards

```
CODE VERIFIED BUSINESS RULES:
1. Non-Negative Quantities: `quantity >= 0`, `estUnitCost >= 0`, `actualUnitCost >= 0`.
2. Decimal Precision Rule: All money rollups use `Math.round((val + EPSILON) * 100) / 100` to prevent floating-point drift.
3. Inventory Reservation Capacity Check: `reserveForBooking()` verifies `availableQty >= requestedQuantity` before creating reservations.
4. Procurement State Machine: `PurchaseRequisition` transitions strictly enforce `PENDING` -> `APPROVED` -> `ORDERED` -> `RECEIVED`.
5. Automatic GL Entry: Receiving a purchase requisition (`markReceived`) automatically invokes `postPurchaseReceivedWithinTx()` to execute database transaction journal entry posting.
```
