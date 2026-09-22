# 25 - Purchase Requisition Approval

---

## 🛡️ Approval & Maker-Checker Controls (`approvePR`)

- **Function**: `approvePR(id)` in `src/actions/procurement.actions.ts`.
- **Precondition**: PR status must be `PENDING`.
- **Maker-Checker Enforcement**: Requisitions CANNOT be approved by the person who requested them (`requestedById !== u.id`), unless the user is `SUPER_ADMIN`:
```typescript
if (pr.requestedById === u.id && u.role !== "SUPER_ADMIN") {
  return { success: false, error: "You can't approve your own requisition (maker-checker)." };
}
```
