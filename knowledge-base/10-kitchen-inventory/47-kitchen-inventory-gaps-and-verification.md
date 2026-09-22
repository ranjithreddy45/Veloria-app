# 47 - Kitchen & Inventory Gaps & Verification Report

---

## 📑 Source-Verified Feature Boundaries

### 1. Confirmed Implemented Features
- Kitchen prep plan creation (`createKitchenPlan`), status state machine (`PLANNED` -> `IN_PROGRESS` -> `COMPLETED`), and headcount source tracking (`CONTRACTED`, `RSVP_CONFIRMED`, `MANUAL`).
- Food cost engine calculating `estFoodCost` and `actualFoodCost` with 2-decimal-place rounding protection.
- Inventory item catalog (`InventoryItem`) with SKU search, reorder level tracking, and `getLowStockAlerts()`.
- Asset reservation system (`InventoryReservation`) date-locking equipment for specific event bookings.
- Purchase requisition workflow (`PurchaseRequisition`) with manager approval and automatic General Ledger accrual posting upon receiving (`markReceived`).

### 2. Partially Implemented Features
- **Automated Prep Ingredient Stock Deduction**: Completing a kitchen plan updates food costs, but does NOT automatically decrement raw stock balances; storekeepers update balances manually.

### 3. Missing / Not Found Features
- **Standalone Recipe BOM System**: Recipes are modeled as `KitchenPlanItem` preparation rows rather than a separate database table.
- **IoT Kitchen Equipment Sensors**: Completely absent from codebase.
- **FIFO / FEFO Expiry Tracking**: No batch lot or expiration date fields exist on `InventoryItem`.
