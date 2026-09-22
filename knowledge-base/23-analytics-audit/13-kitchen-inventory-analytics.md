# 13 Kitchen & Inventory Analytics

`CODE VERIFIED`

## Kitchen Cost & Food Waste Tracking (`src/actions/inventory.actions.ts`)

- **Food Cost Ratio**: Estimated ingredient cost vs total catering revenue.
- **Inventory Valuation**: Total monetary value of stock in hand (`SUM(InventoryItem.quantity * InventoryItem.unitPrice)`).
- **Reorder & Low Stock Alerts**: Highlights items below minimum stock threshold (`InventoryItem.minThreshold`).
- **Wastage Rate**: Logs unconsumed raw materials and food waste per event.
