# 01 Communications Architecture

`CODE VERIFIED`

## Subsystem Architecture & Provider Abstraction

The Veloria Grand Communications subsystem provides a unified, multi-channel messaging infrastructure supporting real-time WhatsApp Business messaging (Meta Cloud API v21.0 or Weflux BSP), transactional & broadcast Email (Resend API), SMS fallback, and Telephony Call Logging.

```
+-----------------------------------------------------------------------------------+
|                            UNIFIED COMMUNICATIONS HUB                             |
|                    (src/actions/communications.actions.ts)                        |
+-----------------------------------------------------------------------------------+
       |                                      |                                   |
       v                                      v                                   v
+-----------------------+          +-----------------------+          +-----------------------+
|  WHATSAPP INTEGRATION |          |    EMAIL INTEGRATION  |          |   TELEPHONY / OTHER   |
| (Meta v21.0 / Weflux) |          |     (Resend API)      |          |  (CallLog / SMS API)  |
+-----------------------+          +-----------------------+          +-----------------------+
       |                                      |                                   |
       v                                      v                                   v
+-----------------------------------------------------------------------------------+
|                        MESSAGING PERSISTENCE & AUDIT LOG                          |
| (WhatsAppMessage, WhatsAppInboundEvent, Communication, EmailTrackingPixel/Event)  |
+-----------------------------------------------------------------------------------+
```

## Key Architectural Principles
1. **Dual Provider Support**: WhatsApp API connects via Meta Cloud API v21.0 (`https://graph.facebook.com/v21.0`) or Weflux BSP (`https://api.weflux.in/v2`), selected by `WhatsAppConfig.provider`.
2. **Fire-and-Forget Resilience**: Transactional email (`sendEmail`) and WhatsApp notifications operate on a fire-and-forget pattern—message dispatch failures are logged but never throw or roll back main database transactions.
3. **Unified Timeline Feed**: `getCommsTimeline()` merges `Communication`, `CallLog`, `WhatsAppMessage`, `SmsMessage`, and `EmailTrackingEvent` into a single chronological timeline per contact or workspace.
4. **Positional Variable Engine**: Named template parameters (`customerName`, `eventDate`) are mapped to Meta's positional placeholders (`{{1}}`, `{{2}}`) using `toPositionalVars()` in `src/lib/whatsapp/template-vars.ts`.
5. **Fail-Closed Webhook Auditing**: Meta webhooks (`/api/webhooks/whatsapp`) persist raw payloads as `WhatsAppInboundEvent` before signature verification, ensuring 100% auditability and replay capability.
