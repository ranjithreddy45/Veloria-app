# 21 - Stock Issues & Consumption Mechanics

---

## 📤 Stock Consumption Status

- **Kitchen Plan Stock Deduction**: **PARTIALLY IMPLEMENTED / MANUAL**. Completing a `KitchenPlan` (`status = COMPLETED`) does NOT automatically decrement `InventoryItem.availableQty` in code.
- **Manual Asset Reservation**: Equipment consumption/reservation for events is handled explicitly via `reserveForBooking` and `releaseReservation` in `src/actions/inventory.actions.ts`.
- **Manual Stock Issue**: Storekeepers manually update `totalQuantity` and `availableQty` via `updateItem` when raw prep stock is issued to kitchen stations.
