# Quotation to Booking Flow

## Overview

Converting accepted quotations directly into confirmed venue bookings and slot locks (`src/actions/quotation-booking.actions.ts`).

---

## Execution Pathway

1. **Trigger**: Client completes one-tap deposit payment via `/q/[token]` (`one-tap-pay.tsx`).
2. **Server Action**: `convertQuotationToBooking()` in `src/actions/quotation-booking.actions.ts`.
3. **Database Operations**:
   - Creates `Booking` record with `venueId`, `eventDate`, `timeSlot`, and `guestCount`.
   - Links `SalesQuotation.bookingId = Booking.id`.
   - Updates `SalesQuotation.status = CONVERTED`.
   - Creates deposit `Invoice` (`SalesQuotation.invoiceId`).
