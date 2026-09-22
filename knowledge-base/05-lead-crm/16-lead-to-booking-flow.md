# Lead to Booking Flow

## Overview

Tracing the progression from an accepted quotation to a confirmed venue booking.

---

## Execution Pathway

1. **Trigger**: Client accepts quotation via `/q/[quoteToken]` or e-signs contract via `/sign/[contractToken]`.
2. **Deposit Payment**: Client pays booking deposit via `/pay/[bookingId]`.
3. **Booking Creation**: Server Action creates `Booking` record with `venueId`, `eventDate`, `slot`, and `guestCount`.
4. **Lead Update**: `Lead.status` is set to `WON`.
