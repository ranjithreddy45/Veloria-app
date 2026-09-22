# 16 Communication Logging

`CODE VERIFIED`

- `getCommsTimeline()` in `src/actions/communications.actions.ts` merges 5 tables into one feed:
  - `Communication`
  - `CallLog`
  - `WhatsAppMessage`
  - `SmsMessage`
  - `EmailTrackingEvent`
