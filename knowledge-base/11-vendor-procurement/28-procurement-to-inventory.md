# 28 - Procurement to Inventory

---

## 📦 Inventory Integration Boundary

- **Purchase Requisitions**: Can reference an optional `bookingId` or `operationId` for event-specific inventory requirements.
- **Stock Updates**: Items received via `markReceived()` update operational stock logs. Low stock levels are monitored via `getLowStockAlerts()`.
