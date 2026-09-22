# 15 Email Marketing

`CODE VERIFIED`

- Email blasts sent via Resend API (`src/lib/email/send-email.ts`).
- Engagement tracking:
  - Open tracking: `EmailTrackingPixel` inserts invisible `1x1` PNG pixel into email HTML. Triggered on `GET /api/track/open/[pixelId]`.
  - Click tracking: `EmailTrackingEvent` wraps links with tracking redirect endpoint `GET /api/track/click/[eventId]`.
