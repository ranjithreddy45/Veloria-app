# 07 WhatsApp Sending and Receiving

`CODE VERIFIED`

## Outbound Dispatch (`sendWhatsApp()`)
- Evaluates `params.template`. If present, calls `sendTemplateMessage()`; otherwise sends raw text message.
- Checks Meta 24-hour session window (`src/lib/whatsapp/session-window.ts`). Outside 24h window, template message is mandatory.

## Inbound Processing (`processMetaWebhookPayload()`)
- Inbound messages parsed by `src/lib/whatsapp/inbound-pipeline.ts`.
- Matches sender phone against `Contact` database records.
- Creates `WhatsAppMessage` record (`direction = INBOUND`).
- Updates `Contact` last interaction timestamp and triggers AI sentiment analysis.
