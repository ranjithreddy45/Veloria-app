# 17 - Booking Amendments & Rescheduling

---

## ✏️ Amendment Rules & Audit Log

- **Allowed Edits (`updateBooking`)**: Sales Executives and Admins can update guest count, time slots, special requests, and internal notes prior to `servicesLockedAt`.
- **Rescheduling (`updateBooking`)**: Changing the event date requires running `checkAvailability(venueId, newDate, newSlot)`. If available, the date is updated and an amendment entry is logged in the audit trail.
- **Commercial Recalculation**: If `guestCount` or package tier is amended, the total contracted amount is re-calculated and any outstanding advance invoice balance is updated accordingly.
