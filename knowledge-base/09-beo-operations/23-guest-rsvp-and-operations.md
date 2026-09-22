# 23 - Guest RSVP Impact on Operations

---

## 📊 Guest RSVP to BEO Integration

- **RSVP Tracking**: Guest RSVPs (`GuestList`, `GuestInvitation`) update the confirmed guest headcount in real time.
- **Headcount Synchronization**: When RSVP responses stabilize, Operations updates `Beo.covers` and sets `coversSource = 'RSVP_CONFIRMED'` via `src/lib/guests/headcount.ts`.
- **Catering Adjustment**: `KitchenPlan.covers` automatically syncs to the updated RSVP headcount, adjusting ingredient ordering and batch sizes.
