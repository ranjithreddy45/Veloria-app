# 13 - Ingredient Management Status

---

## 🔍 Ingredient Master Status

- **Status**: **NOT FOUND AS A SEPARATE STANDALONE MODEL**.
- **Implementation**: Ingredients in Veloria Grand are managed as line items within `KitchenPlanItem` (for batch prep) and `InventoryItem` (for general store stock).
- **Attributes**: Captured via `name`, `category`, `unit` (`KG`, `LTR`, `PCS`, `PACKET`), and `estUnitCost`.
