# Contract to Booking Integration

## Overview

Connecting signed agreements to confirmed venue bookings (`Contract.bookingId` & `SignatureRequest.bookingId`).

---

## Integration Mechanics

- **Booking Linkage**: Signed contracts reference `bookingId` to confirm venue slot reservations.
- **Deposit Trigger**: Contract execution (`status = SIGNED`) triggers booking advance deposit invoice generation (`Invoice` model).
