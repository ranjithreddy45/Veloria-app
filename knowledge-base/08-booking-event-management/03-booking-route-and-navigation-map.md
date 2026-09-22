# 03 - Booking Route & Navigation Map

---

## 🗺️ Exhaustive Booking Route Census

| Route | Type | Role Access | Purpose | Main Components | Server Actions / API |
|---|---|---|---|---|---|
| `/(dashboard)/bookings` | Internal Page | Admin, Sales, Ops | Master list of all bookings with filter, status tabs, and venue selector | `BookingListView`, `BookingFilters` | `getBookings`, `getBookingStats` |
| `/(dashboard)/bookings/new` | Internal Page | Admin, Sales | Manual booking creator form | `BookingCreateForm`, `VenueSelector` | `createBooking`, `checkAvailability` |
| `/(dashboard)/bookings/calendar` | Internal Page | Admin, Sales, Ops | Visual monthly/weekly calendar grid of venue availability and booked slots | `BookingCalendarView` | `getBookingsForCalendar`, `getAvailabilityGrid` |
| `/(dashboard)/bookings/blackouts` | Internal Page | Admin | Management of property blackout dates for maintenance/internal events | `BlackoutDateManager` | `getBlackoutDates`, `createBlackoutDate`, `deleteBlackoutDate` |
| `/(dashboard)/bookings/[bookingId]` | Internal Page | Admin, Sales, Ops | Master booking detail view (overview, commercials, contracts, invoices) | `BookingDetailHeader`, `BookingCommercialsCard` | `getBooking` |
| `/(dashboard)/bookings/[bookingId]/edit` | Internal Page | Admin, Sales | Booking detail editor form | `BookingEditForm` | `updateBooking` |
| `/(dashboard)/bookings/[bookingId]/control` | Internal Page | Admin, Ops | Operational control center for event day execution | `EventControlDashboard` | `getOperationReadinessForBooking` |
| `/(dashboard)/bookings/[bookingId]/day-of` | Internal Page | Ops | Real-time event day run-of-show timeline and staff task board | `DayOfRunOfShow`, `StaffAssignmentBoard` | `getTimeline`, `updateItemStatus` |
| `/(dashboard)/bookings/[bookingId]/execution` | Internal Page | Ops | Event execution plan, vendor bids, and resource allocation | `ExecutionPlanView` | `getBookingExecutionPlan` |
| `/(dashboard)/bookings/[bookingId]/guests` | Internal Page | Admin, Ops | Guest list, RSVP tracker, and invitation manager | `GuestListTable`, `RsvpSummary` | `getGuestList` |
| `/(dashboard)/bookings/[bookingId]/menu` | Internal Page | Ops, Chef | Event menu selection, tasting notes, and dietary restrictions | `MenuSelectionBoard` | `getBookingMenu` |
| `/(dashboard)/bookings/[bookingId]/operations` | Internal Page | Ops | Operational readiness breakdown (kitchen, decor, seating, AV) | `OpsReadinessCard` | `getOperationReadiness` |
| `/(dashboard)/bookings/[bookingId]/seating` | Internal Page | Ops, Host | Interactive seating chart builder and table allocation | `SeatingChartCanvas` | `getSeatingChart` |
| `/(dashboard)/bookings/[bookingId]/tasting` | Internal Page | Sales, Ops, Chef | Food tasting session manager and client feedback recorder | `TastingSessionForm` | `getTastingsByBooking`, `createTasting` |
| `/(dashboard)/beo` | Internal Page | Admin, Ops | Master BEO list view across all active bookings | `BeoListView` | `getBeos` |
| `/(dashboard)/beo/[id]` | Internal Page | Admin, Ops, Kitchen | BEO function sheet editor, run-of-show builder, and incident logger | `BeoEditor`, `BeoRunOfShow` | `getBeo`, `updateBeo`, `addBeoIncident` |
| `/(portal)/portal/bookings` | Client Portal | Client | Client dashboard listing active and past event bookings | `ClientBookingCardList` | `getClientBookings` |
| `/(portal)/portal/bookings/[bookingId]` | Client Portal | Client | Client booking overview portal (timeline, invoices, menus, RSVPs) | `ClientBookingDetailView` | `getPortalBookingDetail` |
| `/(public)/hold` | Public Page | Public | Public slot availability search & instant date hold configurator | `PublicHoldForm`, `DateSlotPicker` | `getPublicAvailabilityGrid`, `createPublicHold` |
| `/(public)/hold/[token]` | Public Page | Public | Tokenized public hold confirmation and deposit payment screen | `PublicHoldPaymentView` | `getPublicHold` |
| `/api/cron/hold-expiry` | API Route | System / Cron | Automated sweep releasing expired un-promoted date holds | N/A | `hold-expiry/route.ts` |
| `/api/cron/event-lifecycle` | API Route | System / Cron | Automated event status transition sweep (HOLD -> CONFIRMED -> COMPLETED) | N/A | `event-lifecycle/route.ts` |
