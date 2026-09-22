# 03 Server Actions Inventory

`CODE VERIFIED`

## 1. `src/actions/whatsapp.actions.ts`
- `sendWhatsAppMessage(to, message)`: Send free-form WhatsApp text message.
- `sendWhatsAppTemplateMessage(to, templateName, params)`: Send Meta-approved template message with named variable mapping.

## 2. `src/actions/whatsapp-inbound.actions.ts`
- `getInboundEvents(params)`: Fetch `WhatsAppInboundEvent` raw log entries for audit.
- `replayInboundEvent(id)`: Re-process failed inbound webhook payload.

## 3. `src/actions/whatsapp-config.actions.ts`
- `getWhatsAppConfig()`: Fetch active `WhatsAppConfig`.
- `updateWhatsAppConfig(data)`: Save Meta Cloud API / Weflux BSP credentials.
- `testWhatsAppConnection()`: Test connection to Meta Graph API or Weflux API.

## 4. `src/actions/communications.actions.ts`
- `getCommsTimeline(params)`: Normalized multi-channel timeline feed (`CALL`, `EMAIL`, `WHATSAPP`, `SMS`, `MEETING`, `NOTE`).
- `getCommsStats(contactId)`: Aggregate communication count breakdown.
- `createNote(contactId, content)`: Log manual CRM note.

## 5. `src/actions/email-template.actions.ts` & `email-tracking.actions.ts`
- `getEmailTemplates()`, `createEmailTemplate()`, `trackEmailOpen()`, `trackEmailClick()`.

## 6. `src/actions/sms.actions.ts`
- `sendSmsFallback(to, message)`: SMS fallback dispatch.
