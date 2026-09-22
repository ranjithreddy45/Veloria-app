# 16 - Portion & Yield Calculation

---

## 🧮 Portion Sizing Formulas

- **Per-Head Portions**: Portion rules are derived from `MenuItem.pricePerHead` and `KitchenPlan.covers`.
- **Category Ratios**:
  - Starters: `Covers × 1.1` (10% buffer for live pass-arounds).
  - Main Course: `Covers × 1.0` (Standard per-head buffet allocation).
  - Desserts: `Covers × 1.5 - 2.0` (Multi-choice dessert units).
