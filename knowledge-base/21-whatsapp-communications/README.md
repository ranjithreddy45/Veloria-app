# Module 21: WhatsApp & Communications

`CODE VERIFIED`

## Module Purpose
The WhatsApp & Communications module handles all customer-facing messaging and transactional alerts for Veloria Grand—from Meta WhatsApp Cloud API v21.0 and Weflux BSP integration, email dispatch via Resend API, template variable substitution (`template-vars.ts`), webhook processing & security verification (`/api/webhooks/whatsapp`), through to unified communications timeline feed aggregation (`getCommsTimeline()`).

---

## Technical & Architecture Summary

### Routes Discovered
- `/settings/integrations/whatsapp` — WhatsApp Configuration & Credentials
- `/settings/integrations/whatsapp-inbound` — WhatsApp Inbound Inspection & Replay Console
- `/whatsapp/console` — Live WhatsApp Chat Console
- `/whatsapp/catalog` — WhatsApp Product Catalog Manager
- `/settings/email-templates` — Email Templates Master
- `/api/webhooks/whatsapp` — Meta Webhook Endpoint (GET verify, POST message/status)
- `/api/track/open/[pixelId]` & `/api/track/click/[pixelId]` — Email Open & Click Tracking
- Cron routes: `/api/cron/payment-reminders`, `/api/cron/site-visit-reminders`, `/api/cron/contract-reminders`, `/api/cron/vendor-reminders`, `/api/cron/guest-reminders`, `/api/cron/whatsapp-inbound-prune`.

### Server Actions Discovered
- `src/actions/whatsapp.actions.ts`: `sendWhatsAppMessage`, `sendWhatsAppTemplateMessage`.
- `src/actions/whatsapp-inbound.actions.ts`: `getInboundEvents`, `replayInboundEvent`.
- `src/actions/whatsapp-config.actions.ts`: `getWhatsAppConfig`, `updateWhatsAppConfig`, `testWhatsAppConnection`.
- `src/actions/communications.actions.ts`: `getCommsTimeline`, `getCommsStats`, `createNote`.
- `src/actions/email-template.actions.ts` & `email-tracking.actions.ts`: `getEmailTemplates`, `createEmailTemplate`, `trackEmailOpen`, `trackEmailClick`.

### Prisma Models Discovered
- `WhatsAppConfig`
- `WhatsAppMessage`
- `WhatsAppInboundEvent`
- `Communication`
- `EmailTemplate`
- `EmailTrackingPixel` & `EmailTrackingEvent`
- `CallLog`
- `PrivacyConsentLedger`

---

## Document Index
1. `01-architecture.md` — Communications Architecture & Providers
2. `02-route-inventory.md` — Route Inventory Across Admin & Public Endpoints
3. `03-server-actions.md` — Server Actions Reference
4. `04-data-models.md` — Prisma Database Schemas
5. `05-enums-and-state-machines.md` — Enums & Message Status Lifecycles
6. `06-whatsapp-integration.md` — Meta Cloud API v21.0 & Weflux Integration
7. `07-whatsapp-sending-receiving.md` — Outbound & Inbound Messaging Pipeline
8. `08-template-engine.md` — Meta Template Variable Mapping & Order
9. `09-crm-entity-associations.md` — Contact, Lead & Booking Entity Linkage
10. `10-automated-triggered-communications.md` — System-Triggered Automated Messaging
11. `11-scheduled-reminders-crons.md` — Scheduled Reminders & Cron Cadences
12. `12-delivery-status-retries.md` — Delivery Status Tracking & Retries
13. `13-webhooks-security.md` — Webhook Subscription & HMAC SHA-256 Security
14. `14-opt-in-consent-dpdp.md` — Privacy Consent & DPDP Compliance
15. `15-rate-limiting-session-windows.md` — Meta 24-Hour Session Window Rules
16. `16-communication-logging.md` — Unified Timeline Feed Aggregation
17. `17-email-communications.md` — Resend Email Integration & Address Safety
18. `18-email-tracking-analytics.md` — Open Pixel & Click Tracking Analytics
19. `19-whatsapp-email-coexistence.md` — WhatsApp & Email Coexistence Strategy
20. `20-module-dependencies.md` — Upstream & Downstream System Dependencies
21. `21-rbac-and-security.md` — RBAC Permissions & Data Security
22. `22-audit-and-compliance.md` — Inbound Event Audit Trail & Activity Logging
23. `23-integrations-matrix.md` — External Communications Provider Matrix
24. `24-configuration-env.md` — Configuration & Environment Variables
25. `25-failure-modes.md` — Failure Modes, Fallbacks & Replay
26. `26-data-flows.md` — Sequence Diagrams & Mermaid Data Flows
27. `27-manual-verification.md` — Manual Verification Protocol

---

CHUNK 21 STATUS: COMPLETE
