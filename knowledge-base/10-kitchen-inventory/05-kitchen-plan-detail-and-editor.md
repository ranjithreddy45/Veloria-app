# 05 - Kitchen Plan Detail & Editor Screen

---

## 🖥️ Editor Layout (`/kitchen/[id]`)

```
+-----------------------------------------------------------------------------------+
| KITCHEN PLAN HEADER: Sharma Wedding Reception                           [DRAFT]   |
| Booking: VG-BK-2026-0042 | BEO: BEO-2026-0108 | Covers: 500 (RSVP_CONFIRMED)         |
+-----------------------------------------------------------------------------------+
| SECTION 1: FOOD COST ACCOUNTING SUMMARY                                           |
| Estimated Food Cost: ₹1,25,000.00 | Actual Food Cost: ₹1,18,500.00 (Variance: -5.2%)|
+-----------------------------------------------------------------------------------+
| SECTION 2: ITEMIZE PREPARATION BATCHES & INGREDIENTS                              |
| - Paneer Tikka | Cat: STARTER | Qty: 550 Plates | Est Unit: ₹80 | Est Total: ₹44,000|
| - Dal Makhani  | Cat: MAIN    | Qty: 500 Pax    | Est Unit: ₹65 | Est Total: ₹32,500|
| - Gulab Jamun  | Cat: DESSERT | Qty: 1000 Pcs   | Est Unit: ₹20 | Est Total: ₹20,000|
| [+ Add Kitchen Item]                                                              |
+-----------------------------------------------------------------------------------+
| SECTION 3: PLAN STATUS & TRANSITIONS                                              |
| Current Status: DRAFT | [Move to IN_PROGRESS] [Mark COMPLETED]                    |
+-----------------------------------------------------------------------------------+
```

---

## ⚙️ Interactive Controls & Action Mapping

| Button / UI Control | Target Server Action | Required Role | State Effect |
|---|---|---|---|
| **Add Plan Item** | `addPlanItem(planId, itemData)` | Chef, Ops | Inserts `KitchenPlanItem`, recalculates `estFoodCost` |
| **Update Item Cost** | `updatePlanItem(itemId, patch)` | Chef | Updates `actualUnitCost`, recalculates `actualFoodCost` |
| **Delete Item** | `deletePlanItem(itemId)` | Chef | Removes `KitchenPlanItem`, updates cost rollups |
| **Start Production** | `updateKitchenPlan(planId, { status: 'IN_PROGRESS' })` | Chef | Moves status to `IN_PROGRESS` |
| **Complete Plan** | `updateKitchenPlan(planId, { status: 'COMPLETED' })` | Chef | Moves status to `COMPLETED`, satisfies readiness gate |
