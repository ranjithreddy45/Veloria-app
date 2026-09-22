# 32 - Vendor Bill Approval

---

## 🛡️ Approval & Maker-Checker Rule (`approveVendorBill`)

- **Server Action**: `approveVendorBill(id)` in `src/actions/vendor-bill.actions.ts`.
- **Permission**: Requires `payouts:approve`.
- **Maker-Checker Enforcement**: The approver MUST NOT be the person who created the bill:
```typescript
if (bill.createdById && bill.createdById === u.id) {
  return { success: false, error: "You created this bill — a different approver must accrue it." };
}
```
