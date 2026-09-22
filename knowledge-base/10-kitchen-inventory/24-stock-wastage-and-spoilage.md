# 24 - Stock Wastage & Spoilage Tracking

---

## 🔍 Wastage System Status

- **Status**: **PARTIALLY IMPLEMENTED VIA COST VARIANCE**.
- **Implementation**: Food wastage is tracked financially by comparing `KitchenPlan.estFoodCost` with `KitchenPlan.actualFoodCost`. Physical spoilage/loss is recorded by manually reducing `InventoryItem.totalQuantity` with an audit reason tag.
