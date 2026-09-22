# 25 - Food Tasting & Menu Finalization

---

## 🍲 Food Tasting Management (`Tasting` / `MenuTasting`)

```typescript
// CODE VERIFIED: src/actions/tasting.actions.ts
export async function createTasting(bookingId: string, data: CreateTastingInput) {
  // Mints MenuTasting session
}
```

- **Tasting Lifecycle**: `SCHEDULED` -> `COMPLETED` / `CANCELLED` / `NO_SHOW`.
- **Chef Feedback Recording**: Captures ratings and notes on spice levels, presentation, and dish substitutions prior to locking the final BEO menu (`servicesLockedAt`).
