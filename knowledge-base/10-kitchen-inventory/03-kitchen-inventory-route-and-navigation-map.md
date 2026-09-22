# 03 - Kitchen & Inventory Route Map

---

## 🗺️ Route Census Table

| Route | Type | Role Access | Purpose | Main Components | Server Actions / API |
|---|---|---|---|---|---|
| `/(dashboard)/kitchen` | Internal Page | Chef, Ops, Admin | Master list of all kitchen prep plans with status filters (`DRAFT`, `IN_PROGRESS`, `COMPLETED`) | `KitchenPlanListView`, `FilterBar` | `getKitchenPlans`, `getBookableEvents` |
| `/(dashboard)/kitchen/[id]` | Internal Page | Chef, Ops | Kitchen prep batch editor, itemized ingredient calculator, and food cost tracker | `KitchenPlanEditor`, `IngredientTable` | `getKitchenPlan`, `updateKitchenPlan`, `addPlanItem` |
| `/(dashboard)/inventory` | Internal Page | Storekeeper, Admin | Master inventory catalog with low-stock alerts, categories, and SKU filters | `InventoryListView`, `LowStockAlert` | `getItems`, `getLowStockAlerts` |
| `/(dashboard)/inventory/new` | Internal Page | Storekeeper, Admin | Form to create a new inventory item | `InventoryItemForm` | `createItem` |
| `/(dashboard)/inventory/[itemId]` | Internal Page | Storekeeper, Admin | Inventory item detail view, current reservations, and stock levels | `InventoryDetailCard`, `ReservationTable` | `getItem`, `reserveForBooking` |
| `/(dashboard)/inventory/[itemId]/edit` | Internal Page | Storekeeper, Admin | Form to update inventory item attributes, reorder level, and total quantity | `InventoryEditForm` | `updateItem` |
| `/(dashboard)/menu` | Internal Page | Chef, Sales, Admin | Master catalog of banquet menu items, cuisines, price per head, and dietary badges | `MenuItemListView` | `getMenuItems` |
| `/(dashboard)/menu/new` | Internal Page | Chef, Admin | Form to create a new banquet menu item | `MenuItemForm` | `createMenuItem` |
| `/(dashboard)/menu/[itemId]/edit` | Internal Page | Chef, Admin | Form to edit menu item details, pricing, and dietary tags | `MenuItemEditForm` | `updateMenuItem` |
| `/(dashboard)/procurement` | Internal Page | Buyer, Admin, Ops | Purchase requisition list with status filters (`PENDING`, `APPROVED`, `ORDERED`, `RECEIVED`) | `ProcurementListView` | `getPurchaseRequisitions` |
| `/(dashboard)/procurement/[id]` | Internal Page | Buyer, Admin | Purchase requisition detail, line items, vendor selection, and approval/receiving buttons | `PRDetailCard`, `PRApprovalBar` | `getPurchaseRequisition`, `approvePR`, `markReceived` |
