# 15 - Recipe & Ingredient Relationships

---

## 🔍 Recipe-Ingredient Linkage

- **Status**: **RELATIONAL ONLY VIA KITCHEN PLAN ITEMS**.
- **Implementation**: Menu items (`MenuItem`) link to `BookingMenuSelection`, which Chefs use to populate `KitchenPlanItem` rows. Raw ingredient breakdowns are entered directly into kitchen plan item descriptions and notes.
