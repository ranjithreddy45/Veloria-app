# 25 Failure Modes & Resiliency

`CODE VERIFIED`

- **Webhook Verification Failure**: Rejects with 403 HTTP status.
- **Provider API Outage**: `sendWhatsApp()` and `sendEmail()` return `{ success: false, error }` without crashing transaction.
- **Webhook Replay**: `replayInboundEvent()` re-dispatches saved payload from `WhatsAppInboundEvent`.
