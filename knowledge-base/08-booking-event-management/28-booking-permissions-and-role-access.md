# 28 - Booking Permissions & Role Access Matrix

---

## 🛡️ Granular Role Access Control (RBAC)

| Role | View Bookings | Create Booking | Edit Commercials | Confirm Booking | Cancel Booking | Publish BEO | Access Portal |
|---|---|---|---|---|---|---|---|
| `SUPER_ADMIN` | ✅ Full | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| `ADMIN` | ✅ Full | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| `SALES_HEAD` | ✅ Full | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ❌ Read Only | ❌ No |
| `SALES_EXEC` | ✅ Assigned | ✅ Yes | ⚠️ Limited | ❌ Requires Appr | ❌ Requires Appr | ❌ Read Only | ❌ No |
| `OPERATIONS_HEAD`| ✅ Full | ❌ No | ❌ Read Only | ❌ No | ❌ No | ✅ Full | ❌ No |
| `EVENT_COORDINATOR`| ✅ Assigned | ❌ No | ❌ Read Only | ❌ No | ❌ No | ✅ Full | ❌ No |
| `FINANCE` | ✅ Financial | ❌ No | ❌ Read Only | ✅ Payment Confirm | ❌ No | ❌ Read Only | ❌ No |
| `CLIENT` | 🔒 Own Event | ❌ No | ❌ No | ❌ No | ❌ No | 🔒 View Only | ✅ Full |
