# 33 - Booking Module External & Internal Integrations

---

## 🔌 System Integration Map

1. **PostgreSQL & Prisma ORM**: Primary relational database store for `Booking`, `Beo`, `EventDayTimeline`, `Venue`, `PublicHold`.
2. **Resend Email API**: HTML transactional emails for booking confirmations and BEO sheets.
3. **Meta WhatsApp Cloud API**: WhatsApp template dispatches (`booking_hold_confirmation`, `booking_confirmed_welcome`, `event_day_reminder`).
4. **Razorpay Payment Gateway**: Online deposit collection and automated invoice settlement webhooks.
5. **AWS S3 / Cloud Storage**: Document storage for BEO sheets, signed contracts, and venue floorplan blueprints.
6. **Google Calendar API**: Syncs event dates to venue manager calendar schedules (`src/actions/notification-settings.actions.ts`).
