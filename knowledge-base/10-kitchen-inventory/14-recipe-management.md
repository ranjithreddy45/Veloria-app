# 14 - Recipe Management Status

---

## 🔍 Recipe System Status

- **Status**: **NOT FOUND AS A SEPARATE RECIPE SCHEMA MODEL**.
- **Implementation**: Structured recipe cards (BOM / Bill of Materials) are not modeled as a separate database table. Kitchen preparation items (`KitchenPlanItem`) are created directly under `KitchenPlan` referencing `MenuItem` titles and aggregated unit costs.
