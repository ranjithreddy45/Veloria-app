# 27 - Booking to BEO Handoff Workflow

---

## 🔄 Handoff Classification & Mechanics

- **Dependency Classification**: **MANUAL / CONDITIONAL**. Creating a BEO requires an explicit user trigger (`createBeo(bookingId)` in `src/actions/beo.actions.ts`). BEO records are NOT automatically minted upon booking confirmation.
- **Data Transfer**:
  - `Booking.id` -> `Beo.bookingId`
  - `Booking.guestCount` -> `Beo.covers` (with `coversSource = 'CONTRACTED'`)
  - `Booking.specialRequests` copied to operational notes.
