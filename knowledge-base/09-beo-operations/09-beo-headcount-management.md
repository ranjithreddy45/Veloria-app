# 09 - BEO Headcount & Covers Management

---

## 👥 Headcount Source Tagging (`coversSource`)

To maintain strict operational clarity and prevent false precision, Veloria Grand enforces explicit headcount source tagging via `src/lib/guests/headcount.ts`:

```typescript
// CODE VERIFIED: src/lib/guests/headcount.ts
export type CoversSource = 'CONTRACTED' | 'RSVP_CONFIRMED' | 'MANUAL';
```

- **`CONTRACTED`**: Agreed minimum guarantee guest count defined during quotation/contracting.
- **`RSVP_CONFIRMED`**: Headcount dynamically computed from client portal RSVP confirmations.
- **`MANUAL`**: Override headcount typed manually by Banquet Operations (e.g., host verbally confirmed 550 pax 24h prior).
- **Kitchen Impact**: `KitchenPlan.covers` reads directly from `Beo.covers`, ensuring kitchen batching aligns with the active headcount source.
