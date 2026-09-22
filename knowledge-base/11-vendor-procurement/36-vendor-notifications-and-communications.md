# 36 - Vendor Notifications & Communications

---

## 💬 Vendor Communication Dispatch

- **Work Order Sent**: `notifySent()` dispatches notifications to linked vendor users and `OPERATIONS_HEAD` staff.
- **Vendor Reminders Cron**: `/api/cron/vendor-reminders` sends automated WhatsApp setup reminders 24 hours prior to event setup.
