# 33 - BEO & Operations Permissions & Role Access Matrix

---

## 🛡️ Granular Role Access Control (RBAC)

| Role | View BEO | Create BEO | Publish BEO | Lock BEO | Manage Tasks | Log Incident | View Kitchen | Work Orders |
|---|---|---|---|---|---|---|---|---|
| `SUPER_ADMIN` | ✅ Full | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Full | ✅ Yes | ✅ Full | ✅ Full |
| `ADMIN` | ✅ Full | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Full | ✅ Yes | ✅ Full | ✅ Full |
| `OPERATIONS_HEAD`| ✅ Full | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Full | ✅ Yes | ✅ Read Only | ✅ Full |
| `EVENT_COORDINATOR`| ✅ Assigned | ✅ Yes | ❌ Read Only | ❌ Read Only | ✅ Assigned | ✅ Yes | ❌ Read Only | ⚠️ View Only |
| `SALES_HEAD` | ✅ Read Only | ❌ No | ❌ No | ❌ No | ❌ Read Only | ❌ No | ❌ No | ❌ No |
| `CHEF` | 🔒 Menu Only | ❌ No | ❌ No | ❌ No | 🔒 Kitchen | ❌ No | ✅ Full | ❌ No |
| `VENDOR` | ❌ No | ❌ No | ❌ No | ❌ No | 🔒 Assigned | ❌ No | ❌ No | 🔒 Own WOs |
