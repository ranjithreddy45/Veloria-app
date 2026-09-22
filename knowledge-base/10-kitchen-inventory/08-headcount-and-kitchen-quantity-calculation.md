# 08 - Headcount & Kitchen Quantity Calculations

---

## 🧮 Quantity Calculation Mechanics

In Veloria Grand, kitchen item quantities scale dynamically based on BEO headcount and category buffer multipliers:

```typescript
// CODE VERIFIED: src/actions/kitchen.actions.ts
// Items scale based on covers and category portion ratios:
// Starters: Pax + 10% buffer (e.g. 500 pax -> 550 portions)
// Main Course: Pax exact (e.g. 500 pax -> 500 portions)
// Desserts: 2 units per pax (e.g. 500 pax -> 1000 pieces)
```

- **Headcount Source Integrity**: `coversSource` explicitly tags whether quantities are derived from contracted minimums (`CONTRACTED`) or confirmed client RSVPs (`RSVP_CONFIRMED`).
