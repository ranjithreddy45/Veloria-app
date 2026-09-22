# 35 - Kitchen & Inventory Reconciliation

---

## 🔄 Batch Reconciliation

- **Post-Event Audit**: Chefs review remaining prep quantities, update `actualUnitCost`, and record unused stock items.
- **Manual Stock Return**: Unused equipment or non-perishable store items reserved via `InventoryReservation` are released via `releaseReservation()`.
