# Guest Routes (28 Endpoints)

## Overview

Guest routes (`(guest)` / `/guest/*`, `/event-guest/*`) provide unauthenticated or invitation-token-authenticated access for event attendees to RSVP, view event schedules, access venue directions, and submit dietary requirements.

---

## Guest Route Highlights

- **`/guest/rsvp/[token]`**: Dynamic RSVP page for invited guests. Token maps to `GuestInvitation` record.
- **`/guest/event/[id]`**: Interactive digital event itinerary, seating plan, and photo gallery.
- **`/guest/checkin`**: QR-code-based event entry pass.
