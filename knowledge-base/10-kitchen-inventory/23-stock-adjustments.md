# 23 - Stock Adjustments & Quantity Corrections

---

## ✏️ Manual Quantity Adjustment

- **Action**: `updateItem(id, { totalQuantity, availableQty })` in `src/actions/inventory.actions.ts`.
- **Audit Logging**: Manual quantity changes trigger `logActivity()` entries recording user ID, previous quantity, updated quantity, and adjustment reason.
