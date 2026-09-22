# 33 - Kitchen Food Costing Engine

---

## 💰 Food Cost Calculation Formulas

```typescript
// CODE VERIFIED: src/actions/kitchen.actions.ts
// 1. Estimated Food Cost = ∑ (quantity × estUnitCost)
// 2. Actual Food Cost    = ∑ (quantity × actualUnitCost) [when actuals are present]
```

- **Decimal Precision**: All item costs are calculated using `Math.round((sum + Number.EPSILON) * 100) / 100` to ensure exact 2-decimal-place accuracy.
