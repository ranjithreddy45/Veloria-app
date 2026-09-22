# 37 - Vendor Permissions & Role Access

---

## 🔑 Granular Permission Matrix

| Role | Vendor View | Vendor Create/Edit | Work Order Action | Approve PR | Approve Vendor Bill | Vendor Portal |
|---|---|---|---|---|---|---|
| `SUPER_ADMIN` | ✅ Full | ✅ Full | ✅ Full | ✅ Full (No Maker-Checker restriction) | ✅ Full | ❌ Staff View |
| `ADMIN` | ✅ Full | ✅ Full | ✅ Full | ✅ Maker-Checker | ✅ Maker-Checker | ❌ Staff View |
| `OPERATIONS_HEAD` | ✅ Full | ✅ Create/Edit | ✅ Full | ✅ Maker-Checker | ❌ | ❌ Staff View |
| `EVENT_COORDINATOR` | ✅ View | ❌ | ✅ Assign/Sign | ❌ | ❌ | ❌ Staff View |
| `BUYER` | ✅ View | ❌ | ❌ | ✅ Create PR | ❌ | ❌ Staff View |
| `FINANCE` | ✅ View | ❌ | ❌ View | ❌ | ✅ Approve Bills | ❌ Staff View |
| `VENDOR` | ❌ Own Only | ❌ | 📜 Sign WO | ❌ | ❌ | ✅ Full Portal |
