# 21 - Booking to Operations Handoff

---

## ⚙️ Operations Readiness Engine

Banquet Operations interfaces with a booking via `src/actions/ops-readiness.actions.ts`.

- **Operational Readiness Checks**:
  - `getOperationReadinessForBooking(bookingId)` evaluates menu lock status (`servicesLockedAt`), BEO publication, staffing assignment (`Shift`), vendor task completion (`VendorBid`), and inventory reservation (`InventoryReservation`).
- **Event Day Dashboard (`/bookings/[bookingId]/day-of`)**: Provides real-time timeline monitoring (`EventDayTimeline`), staff task execution boards, and incident reporting (`BeoIncident`).
