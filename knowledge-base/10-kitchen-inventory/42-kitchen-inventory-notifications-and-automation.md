# 42 - Kitchen & Inventory Notifications & Automation

---

## 🔔 Alerts & System Triggers

- **Low Stock Dashboard Warning**: `getLowStockAlerts()` queries items where `availableQty <= reorderLevel` and highlights warning badges in inventory.
- **Procurement Approval Email**: Resend notification dispatches when a `PurchaseRequisition` requires manager sign-off.
- **Readiness Watchdog Integration**: Optional Gate 4 in `/api/cron/readiness-watchdog` checks if kitchen prep plan status is `COMPLETED`.
