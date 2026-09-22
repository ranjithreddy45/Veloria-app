# 18 - Stock Item Management

---

## 🛠️ Inventory Item CRUD (`src/actions/inventory.actions.ts`)

- **`getItems(params)`**: Fetches paginated, searchable inventory catalog with SKU and category filters.
- **`createItem(data)`**: Creates a new inventory item with initial `totalQuantity`, `availableQty`, and `reorderLevel`.
- **`updateItem(id, data)`**: Modifies stock item properties, storage location, or reorder thresholds.
- **`getLowStockAlerts()`**: Queries items where `availableQty <= reorderLevel`, displaying warning badges on the dashboard.
