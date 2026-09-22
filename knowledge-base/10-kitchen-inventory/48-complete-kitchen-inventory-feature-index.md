# 48 - Complete Kitchen & Inventory Feature Index

---

## 🗂️ Verified Feature Catalog

| ID | Feature Name | Route / Path | Action / API | Model | Roles | Status | Dependency Type | Source Evidence |
|---|---|---|---|---|---|---|---|---|
| **KITCHEN-001** | Create Kitchen Plan | `/kitchen` | `createKitchenPlan` | `KitchenPlan` | Chef, Ops | `IMPLEMENTED` | `MANUAL` | `src/actions/kitchen.actions.ts` |
| **KITCHEN-002** | Add Kitchen Plan Item | `/kitchen/[id]` | `addPlanItem` | `KitchenPlanItem` | Chef | `IMPLEMENTED` | `MANUAL` | `src/actions/kitchen.actions.ts` |
| **KITCHEN-003** | Update Actual Unit Cost | `/kitchen/[id]` | `updatePlanItem` | `KitchenPlanItem` | Chef | `IMPLEMENTED` | `MANUAL` | `src/actions/kitchen.actions.ts` |
| **KITCHEN-004** | Complete Kitchen Plan | `/kitchen/[id]` | `updateKitchenPlan` | `KitchenPlan` | Chef | `IMPLEMENTED` | `MANUAL` | `src/actions/kitchen.actions.ts` |
| **KITCHEN-005** | View Inventory List | `/inventory` | `getItems` | `InventoryItem` | Storekeeper, Admin | `IMPLEMENTED` | `MANUAL` | `src/actions/inventory.actions.ts` |
| **KITCHEN-006** | Create Inventory Item | `/inventory/new` | `createItem` | `InventoryItem` | Storekeeper, Admin | `IMPLEMENTED` | `MANUAL` | `src/actions/inventory.actions.ts` |
| **KITCHEN-007** | Low Stock Alerts | `/inventory` | `getLowStockAlerts` | `InventoryItem` | Storekeeper, Admin | `IMPLEMENTED` | `AUTOMATIC` | `src/actions/inventory.actions.ts` |
| **KITCHEN-008** | Reserve Asset for Event | `/inventory/[id]` | `reserveForBooking` | `InventoryReservation` | Storekeeper, Ops | `IMPLEMENTED` | `MANUAL` | `src/actions/inventory.actions.ts` |
| **KITCHEN-009** | Release Asset Hold | `/inventory/[id]` | `releaseReservation` | `InventoryReservation` | Storekeeper, Ops | `IMPLEMENTED` | `MANUAL` | `src/actions/inventory.actions.ts` |
| **KITCHEN-010** | Create Purchase Requisition | `/procurement` | `createPurchaseRequisition` | `PurchaseRequisition` | Buyer, Ops | `IMPLEMENTED` | `MANUAL` | `src/actions/procurement.actions.ts` |
| **KITCHEN-011** | Approve PR | `/procurement/[id]` | `approvePR` | `PurchaseRequisition` | Buyer, Admin | `IMPLEMENTED` | `MANUAL` | `src/actions/procurement.actions.ts` |
| **KITCHEN-012** | Mark PR Received & GL Post | `/procurement/[id]` | `markReceived` | `PurchaseRequisition` | Buyer, Admin | `IMPLEMENTED` | `AUTOMATIC` | `src/actions/procurement.actions.ts` |
