# 16 Guest App / Mobile PWA Experience (`/app/*`)

`CODE VERIFIED`

## Guest Mobile Experience Architecture (`(guest)` Route Group)

The `/app/*` route family powers the lightweight Mobile PWA for event guests, offering an interactive digital concierge, live schedule, food menu, seating chart, and venue guide.

```
+-----------------------------------------------------------------------------------+
|                            GUEST MOBILE PWA (/app)                                |
+-----------------------------------------------------------------------------------+
  |               |                 |                 |                  |
  v               v                 v                 v                  v
+----------+ +------------+ +---------------+ +---------------+ +------------------+
| LIVE MSG | | EVENT MENU | | SEATING CHART | | AI CONCIERGE  | | VENUE PHOTOS     |
|/app/event| |/app/.../menu| |/app/.../guests| |/app/concierge | |/app/venues/...  |
+----------+ +------------+ +---------------+ +---------------+ +------------------+
```

### Technology & Features
- Built with standard React Server Components + Client components optimized for Capacitor 8.1 iOS/Android wrappers.
- Guest Concierge (`/app/concierge`): Powered by `/api/ai/chat` for automated Q&A regarding venue directions, parking, dress code, and event timing.
- RSVP Management (`/app/book/held/[token]`): Allows guests to update attendance and dietary restrictions.
