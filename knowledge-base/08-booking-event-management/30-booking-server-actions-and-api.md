# 30 - Booking Server Actions & API Inventory

---

## ⚡ Server Actions Registry (`src/actions/booking.actions.ts`)

| Action Name | Location File | Purpose | Key Parameters | Return Type |
|---|---|---|---|---|
| `generateBookingNumber` | `booking.actions.ts` | Generates sequential VG-BK ID | None | `Promise<string>` |
| `getBookings` | `booking.actions.ts` | Fetches filtered booking list | `filters: BookingFilters` | `Promise<Booking[]>` |
| `getBooking` | `booking.actions.ts` | Fetches full booking details | `bookingId: string` | `Promise<Booking>` |
| `checkAvailability` | `booking.actions.ts` | Validates date/slot availability | `venueId, date, timeSlot` | `Promise<boolean>` |
| `createBooking` | `booking.actions.ts` | Creates direct booking | `data: CreateBookingInput` | `Promise<Booking>` |
| `updateBooking` | `booking.actions.ts` | Amends booking attributes | `bookingId, data` | `Promise<Booking>` |
| `confirmBooking` | `booking.actions.ts` | Promotes HOLD to CONFIRMED | `bookingId: string` | `Promise<Booking>` |
| `cancelBooking` | `booking.actions.ts` | Cancels booking & frees slot | `bookingId, reason` | `Promise<Booking>` |
| `placeHold` | `booking.actions.ts` | Places temporary date hold | `bookingId, expiresAt` | `Promise<Booking>` |
| `releaseHold` | `booking.actions.ts` | Manually releases date hold | `bookingId: string` | `Promise<Booking>` |
| `createBeo` | `beo.actions.ts` | Mints new BEO function sheet | `bookingId: string` | `Promise<Beo>` |
| `createBookingInvoiceFromQuotation` | `booking-invoice.actions.ts` | Converts quotation into booking & invoice | `quotationId: string` | `Promise<{booking, invoice}>` |
