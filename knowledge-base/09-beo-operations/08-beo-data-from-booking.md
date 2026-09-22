# 08 - Booking Data Flow into BEO

---

## 📋 Data Transfer Mapping

| Originating Booking Field | Target BEO Attribute | Transformation / Notes |
|---|---|---|
| `Booking.id` | `Beo.bookingId` | Direct foreign key relation |
| `Booking.bookingNumber` | Rendered Header Link | Displayed as `Originating Booking: VG-BK-2026-0042` |
| `Booking.guestCount` | `Beo.covers` | Initialized as default contracted headcount |
| `Booking.eventName` | Rendered Header Title | Displayed as BEO title |
| `Booking.venueId` | Rendered Space Attribute | Fetches venue name, capacity, and in-house catering rules |
| `Booking.specialRequests` | Rendered Special Notes Section | Textual requirements copied into BEO operational notes |
