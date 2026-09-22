# 24 - Booking Client Portal Capabilities

---

## 📱 Client Self-Service Features (`/portal/bookings/[bookingId]`)

Clients access a dedicated self-service portal featuring:

1. **Event Overview & Countdown**: Displays event date, time slot, venue hall, and assigned Event Coordinator contact details.
2. **Interactive Guest RSVP Tracker**: Client manages guest invitations, tracks attendance status, and gathers dietary preferences (`/portal/guests/[bookingId]`).
3. **Menu Selection & Customization**: Client selects starters, mains, and desserts prior to `servicesLockedAt`.
4. **Interactive Seating Builder**: Allows client to arrange tables, assign guest seats, and download PDF seating floorplans (`/bookings/[bookingId]/seating`).
5. **Invoices & Payment Receipts**: Instant download of GST invoices, advance receipts, and online Razorpay payment processing.
