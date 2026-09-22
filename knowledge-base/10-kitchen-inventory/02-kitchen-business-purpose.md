# 02 - Kitchen & Inventory Business Purpose

---

## 🎯 Business & Operational Purpose

```
CODE VERIFIED BUSINESS BEHAVIOR:
1. Batch Kitchen Production: Create itemized batch preparation plans (KitchenPlanItem) linked to specific event bookings and BEO function sheets (src/actions/kitchen.actions.ts).
2. Food Cost Control: Automatically calculate estimated food costs (estFoodCost = ∑ quantity × estUnitCost) and track actual food costs (actualFoodCost) to calculate gross margin variances.
3. Asset & Inventory Reservations: Lock physical venue assets/equipment (InventoryItem) for specific event dates (InventoryReservation) to prevent hardware shortages.
4. Procurement Accrual Posting: Approving and receiving purchase requisitions (markReceived) automatically creates General Ledger accrual entries for inventory purchases (src/lib/finance/procurement.ts).

INFERRED BUSINESS PURPOSE:
- Provides culinary teams with historical dish food-cost benchmarks to optimize future banquet menu pricing tiers.
```

---

## 🔄 Cross-Module Operational Flow

| Source System | Handoff Action | Target Model / Action | Evidence |
|---|---|---|---|
| **BEO / Operations** | BEO published -> Chef creates batch plan | `createKitchenPlan(bookingId, beoId)` | `src/actions/kitchen.actions.ts` |
| **Menu & Catering** | Selected menu items added to kitchen plan | `KitchenPlanItem` (name, quantity, unit) | `src/actions/kitchen.actions.ts` |
| **Procurement** | Requisition marked received -> GL entry | `markReceived(prId)` & GL Journal | `src/actions/procurement.actions.ts` |
| **Operations Readiness** | Kitchen plan completion feeds gate score | `computeOperationReadiness()` (Gate 4) | `src/lib/ops/state-machine.ts` |
