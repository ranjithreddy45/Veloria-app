# 45 - Kitchen & Inventory Feature Dependency Map

---

## 🔄 Dependency Classification Graph

```mermaid
graph TD
    Booking[Booking] -->|MANUAL: createKitchenPlan| Kitchen[KitchenPlan]
    Beo[Beo Sheet] -->|INHERITED COVERS| Kitchen
    Kitchen -->|ROLLUP: rollupEstFoodCost| EstCost[Estimated Food Cost]
    Kitchen -->|ROLLUP: rollupActualFoodCost| ActCost[Actual Food Cost]
    Kitchen -.->|OPTIONAL GATE 4| Readiness[Ops Readiness Engine]
    PR[PurchaseRequisition] -->|AUTOMATIC: markReceived| GL[General Ledger Inventory Accrual]
    Inv[InventoryItem] -->|MANUAL: reserveForBooking| Res[InventoryReservation]
```

- **AUTOMATIC**: `PurchaseRequisition -> GeneralLedger` (Accrual entry generated upon `markReceived`).
- **MANUAL**: `Booking -> KitchenPlan`, `KitchenPlan -> KitchenPlanItem`, `InventoryItem -> InventoryReservation`.
- **CONDITIONAL**: `KitchenPlan -> computeOperationReadiness()` (Optional Gate 4).
