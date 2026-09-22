# 05 - Booking Detail & Editor Screen

---

## 🖥️ Screen Layout & Components (`/bookings/[bookingId]`)

The master booking screen (`src/app/(dashboard)/bookings/[bookingId]/page.tsx`) organizes operational and commercial management into tabbed sub-views:

```
+-----------------------------------------------------------------------------------+
| HEADER: [VG-BK-2026-0042] Sharma Wedding Reception                     [CONFIRMED]|
| Client: Rahul Sharma | Venue: Grand Ballroom | Date: 15 Oct 2026 | Slot: EVENING  |
+-----------------------------------------------------------------------------------+
| [Overview] [Commercials] [Day-Of Timeline] [BEO] [Guests/RSVP] [Seating] [Tasting]|
+-----------------------------------------------------------------------------------+
| OVERVIEW TAB CONTENT:                                                             |
| - Commercial Summary: ₹12,50,000 Total | Paid: ₹3,00,000 | Due: ₹9,50,000           |
| - Key Contacts & Sales Owner: Vikram Singh (Sales Lead)                           |
| - Operational Readiness Indicator: 85% Ready (Kitchen: OK, Decor: Pending)         |
| - Linked Contract: VG-CT-2026-0019 [SIGNED]                                       |
| - Linked Invoice: VG-INV-2026-0088 [PARTIALLY_PAID]                               |
+-----------------------------------------------------------------------------------+
```

---

## ⚙️ Interactive Buttons & Server Action Map

| Button / UI Action | Target Server Action | Required Role | State Effect |
|---|---|---|---|
| **Confirm Booking** | `confirmBooking(bookingId)` | Admin, Sales Head | Sets status = `CONFIRMED`, locks slot |
| **Edit Booking Details** | `updateBooking(bookingId, data)` | Admin, Sales Exec | Updates pax, date, venue, special requests |
| **Cancel Booking** | `cancelBooking(bookingId, reason)` | Admin, Sales Head | Sets status = `CANCELLED`, releases slot |
| **Place Temporary Hold** | `placeHold(bookingId, expiresAt)` | Sales Exec | Sets status = `HOLD`, updates `holdExpiresAt` |
| **Release Hold** | `releaseHold(bookingId)` | Sales Exec, Admin | Sets status = `CANCELLED`, opens availability |
| **Generate BEO Sheet** | `createBeo(bookingId)` | Operations Head | Mints `Beo` record linked to booking |
| **Schedule Tasting** | `createTasting(bookingId, date)` | Sales Exec, Chef | Mints `Tasting` session record |
