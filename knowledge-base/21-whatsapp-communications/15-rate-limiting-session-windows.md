# 15 Rate Limiting & Session Windows

`CODE VERIFIED`

- **Meta 24-Hour Session Window**: Tracked in `src/lib/whatsapp/session-window.ts`. Free-form text messages permitted only within 24 hours of last customer inbound message; template messages required outside 24h window.
- **Rate Limiting**: Public forms and APIs use `checkRateLimit()` from `src/lib/rate-limit.ts`.
