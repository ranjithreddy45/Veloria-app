# 38 - Kitchen & Inventory Permissions & Role Access Matrix

---

## 🛡️ Granular Role Access Control (RBAC)

| Role | View Kitchen | Edit Kitchen | View Inventory | Edit Inventory | Approve PR | Mark Received | View Costs |
|---|---|---|---|---|---|---|---|
| `SUPER_ADMIN` | ✅ Full | ✅ Yes | ✅ Full | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Full |
| `ADMIN` | ✅ Full | ✅ Yes | ✅ Full | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Full |
| `CHEF` | ✅ Full | ✅ Yes | 🔒 View Only | ❌ No | ❌ Request Only | ❌ No | ✅ Food Costs |
| `OPERATIONS_HEAD`| ✅ Full | ✅ Yes | ✅ Full | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Full |
| `BUYER` / `PROCUREMENT`| 🔒 Read Only | ❌ No | ✅ Full | ❌ Read Only | ✅ Yes | ✅ Yes | ✅ Full |
| `STOREKEEPER` | ❌ No | ❌ No | ✅ Full | ✅ Yes | ❌ No | ✅ Yes | ❌ Read Only |
