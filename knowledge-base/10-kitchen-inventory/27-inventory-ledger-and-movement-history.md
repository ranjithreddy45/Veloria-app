# 27 - Inventory Ledger & Movement History

---

## 📜 Movement Audit Trail

- **Activity Logs**: Stock changes trigger entries in the global activity log (`ActivityLog` model via `logActivity()`).
- **Reservation Ledger**: `InventoryReservation` maintains a historical record of all asset holds (`RESERVED`, `DISPATCHED`, `RETURNED`, `CANCELLED`).
