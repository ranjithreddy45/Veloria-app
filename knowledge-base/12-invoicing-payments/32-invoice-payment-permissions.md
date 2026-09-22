# 32 - Invoice & Payment Permissions

---

## 🔑 RBAC Permission Matrix

| Role | View Invoices | Create Invoice | Cancel Invoice | Record Payment | Refund Payment | View GL |
|---|---|---|---|---|---|---|
| `SUPER_ADMIN` | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| `ADMIN` | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| `FINANCE` | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| `SALES_HEAD` | ✅ Full | ✅ Create | ❌ | ✅ View | ❌ | ❌ |
| `SALES_EXEC` | ✅ Own Only | ✅ Create | ❌ | ❌ | ❌ | ❌ |
| `CLIENT` | ✅ Portal | ❌ | ❌ | 📜 Pay Online | ❌ | ❌ |
