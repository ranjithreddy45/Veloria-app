# 09 - Menu Selection to Kitchen Preparation

---

## 🍲 Menu Item Conversion

- **Menu Master (`MenuItem`)**: Stores item name, cuisine, category (`STARTER`, `MAIN`, `DRESSING`, `DESSERT`, `BEVERAGE`), price per head, and dietary badges (`VEG`, `NON_VEG`, `JAIN`, `GLUTEN_FREE`).
- **Plan Conversion**: Chef imports selected `MenuItem` records into the `KitchenPlan`, specifying target preparation batch sizes and estimated unit costs (`estUnitCost`).
