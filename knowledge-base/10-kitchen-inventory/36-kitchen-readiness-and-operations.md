# 36 - Kitchen Readiness & Operational Readiness

---

## 🎯 Readiness Gate Evaluation (`computeOperationReadiness`)

```typescript
// CODE VERIFIED: src/lib/ops/state-machine.ts
// Optional Gate 4: Kitchen Plan Finalised
{
  key: "kitchen",
  label: "Kitchen plan finalised",
  required: false,
  ready: !kitchen || kitchen.status === "COMPLETED",
  detail: kitchen ? `Kitchen ${kitchen.status}` : "No kitchen plan"
}
```

- **Gate Status**: Evaluates whether `KitchenPlan.status === 'COMPLETED'`.
