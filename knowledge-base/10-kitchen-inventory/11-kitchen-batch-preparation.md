# 11 - Kitchen Batch Preparation

---

## 🍳 Batch Cooking Mechanics

Catering prep items are batch-cooked based on preparation schedules:
- **Batch Sizing**: Quantities are calculated in bulk units (e.g. 50 KG Paneer Gravy, 400 LTR Soup).
- **Execution Tracking**: Kitchen staff updates `KitchenPlan.status` from `DRAFT` to `IN_PROGRESS` as cooking begins.
- **Cost Reconciliation**: Post-cooking, Head Chef inputs actual per-unit costs (`actualUnitCost`), which automatically rolls up to `KitchenPlan.actualFoodCost`.
