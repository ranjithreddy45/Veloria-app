# 38 - Complete Booking Feature Index

---

## 🗂️ Granular Feature Catalog

| Feature ID | Feature Name | Route / Path | Server Action / API | Prisma Model | Roles | Status |
|---|---|---|---|---|---|---|
| **BOOKING-001** | Create Manual Booking | `/bookings/new` | `createBooking` | `Booking` | Admin, Sales | `IMPLEMENTED` |
| **BOOKING-002** | View Booking List | `/bookings` | `getBookings` | `Booking` | Admin, Sales, Ops | `IMPLEMENTED` |
| **BOOKING-003** | Booking Detail Dashboard | `/bookings/[bookingId]` | `getBooking` | `Booking` | Admin, Sales, Ops | `IMPLEMENTED` |
| **BOOKING-004** | Edit Booking | `/bookings/[bookingId]/edit` | `updateBooking` | `Booking` | Admin, Sales | `IMPLEMENTED` |
| **BOOKING-005** | Confirm Booking | `/bookings/[bookingId]` | `confirmBooking` | `Booking` | Admin, Sales Head | `IMPLEMENTED` |
| **BOOKING-006** | Cancel Booking | `/bookings/[bookingId]` | `cancelBooking` | `Booking` | Admin, Sales Head | `IMPLEMENTED` |
| **BOOKING-007** | Check Availability | `/bookings/new` | `checkAvailability` | `Booking`, `Venue` | Admin, Sales | `IMPLEMENTED` |
| **BOOKING-008** | Convert Quotation | `/quotations/[id]` | `createBookingInvoiceFromQuotation` | `Booking`, `Invoice` | Admin, Sales | `IMPLEMENTED` |
| **BOOKING-009** | Create BEO Sheet | `/beo` | `createBeo` | `Beo` | Admin, Ops | `IMPLEMENTED` |
| **BOOKING-010** | Log BEO Incident | `/beo/[id]` | `addBeoIncident` | `BeoIncident` | Admin, Ops | `IMPLEMENTED` |
| **BOOKING-011** | Day-Of Timeline Control | `/bookings/[bookingId]/day-of` | `getTimeline`, `updateItemStatus` | `EventDayTimeline` | Admin, Ops | `IMPLEMENTED` |
| **BOOKING-012** | Seating Builder | `/bookings/[bookingId]/seating` | `getSeatingChart` | `SeatingChart` | Admin, Ops, Host | `IMPLEMENTED` |
| **BOOKING-013** | Tasting Session Manager | `/bookings/[bookingId]/tasting` | `createTasting`, `confirmTasting` | `Tasting` | Admin, Sales, Chef | `IMPLEMENTED` |
| **BOOKING-014** | Public Date Hold | `/public/hold` | `createPublicHold` | `PublicHold` | Public | `IMPLEMENTED` |
| **BOOKING-015** | Hold Expiry Cron | `/api/cron/hold-expiry` | `hold-expiry/route.ts` | `Booking` | System / Cron | `IMPLEMENTED` |
| **BOOKING-016** | Event Lifecycle Cron | `/api/cron/event-lifecycle` | `event-lifecycle/route.ts` | `Booking` | System / Cron | `IMPLEMENTED` |
| **BOOKING-017** | Blackout Date Manager | `/bookings/blackouts` | `createBlackoutDate` | `BlackoutDate` | Admin | `IMPLEMENTED` |
| **BOOKING-018** | Client Booking Portal | `/portal/bookings/[bookingId]` | `getPortalBookingDetail` | `Booking` | Client | `IMPLEMENTED` |
