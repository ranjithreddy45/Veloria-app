# 08 Template Engine & Variable Mapping

`CODE VERIFIED`

- Single source of truth: `src/lib/whatsapp/template-vars.ts`.
- Maps named parameters to Meta's ascending positional placeholders (`{{1}}`, `{{2}}`, `{{3}}`).
- Standard pre-approved templates:
  - `booking_confirmation`: `["customerName", "eventDate", "venueName"]`
  - `review_request`: `["customerName", "eventName", "reviewLink"]`
  - `payment_reminder`: `["customerName", "amount", "dueDate"]`
  - `event_reminder`: `["customerName", "eventDate", "eventTime"]`
  - `quote_sent`: `["customerName", "quoteNumber"]`
  - `guest_invitation`: `["guestName", "eventName", "eventDate", "eventTime", "venueName", "hostName", "rsvpLink"]`
  - `save_the_date`: `["guestName", "eventName", "eventDate", "venueName", "daysUntil"]`
  - `tomorrow_reminder`: `["guestName", "eventName", "eventTime", "venueName", "dressCode"]`
