# 11 - Guest Count & Venue Capacity Management

---

## 👥 Guest Headcount Tracking Mechanics

In Veloria Grand, guest headcount drives dynamic pricing, banquet room setup, menu batching, and kitchen prep sizing.

```
CODE VERIFIED HEADCOUNT MODES:
- CONTRACTED: Agreed minimum guarantee guest count defined during quotation/booking creation.
- RSVP_CONFIRMED: Aggregate headcount computed from client portal RSVP responses (written via src/lib/guests/headcount.ts).
- MANUAL: Manual headcount overwrite entered by Banquet Operations or Sales Executive.
```

- **Venue Maximum Capacity Guard**: When creating or editing a booking, `guestCount` is checked against `Venue.capacity`. If `guestCount > Venue.capacity`, the UI throws a validation warning.
