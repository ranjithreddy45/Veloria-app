# 06 Client Booking & Event Experience

`CODE VERIFIED`

## Client Booking Details (`/portal/bookings/[bookingId]`)

Clients can monitor their event lifecycle, view operational timelines, review BEO summaries (sanitized for client view), and manage guest RSVPs.

### Client Viewable Booking Data Elements

- **Header**: Booking Code, Event Title, Event Type (Wedding, Corporate, Gala), Event Date, Guest Count.
- **Venue & Space**: Primary Venue Name, Hall/Lawn designation, Setup Hours, Event Start/End time.
- **Financial Summary**: Total Booking Value, Total Paid, Balance Due, Payment Schedule.
- **Event Operations**: Client-facing BEO summary, Menu Package selection, Service add-ons.
- **Milestone Tracker**: Contract Signed, Advance Received, Food Tasting Completed, BEO Finalized, Final Payment Cleared.

### Guest Management Integration

From `/portal/guests/[bookingId]`, the client can:
1. Import guest lists via CSV/Excel.
2. View real-time RSVP responses (Accepted, Declined, Pending).
3. Assign table numbers and dietary preferences.
4. Trigger WhatsApp/Email invitations directly from the portal (`sendGuestInvitation()`).
