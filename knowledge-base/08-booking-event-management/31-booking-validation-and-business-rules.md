# 31 - Booking Validation & Business Rules

---

## 🛑 Validation Rules & Safeguards

```
CODE VERIFIED BUSINESS RULES:
1. Slot Conflict Safeguard: `checkAvailability` blocks creating a booking for a `venueId`, `date`, and `timeSlot` if a `HOLD`, `CONFIRMED`, or `IN_PROGRESS` booking exists.
2. Capacity Bound: Warning triggered if `guestCount` exceeds `Venue.capacity`.
3. Non-Negative Commercials: `totalAmount >= 0`, `perPlatePrice >= 0`, `hallRental >= 0`.
4. Mandatory Reason on Cancel: `cancelBooking(bookingId, reason)` requires string reason input.
5. Headcount Explicit Source: Headcount updates on BEO sheets enforce explicit tagging (`CONTRACTED`, `RSVP_CONFIRMED`, `MANUAL`) via `src/lib/guests/headcount.ts`.
```
