# 02 Route Inventory

`CODE VERIFIED`

## Admin & Settings Routes
- `/settings/integrations/whatsapp` — WhatsApp Configuration & Credentials (`src/app/(dashboard)/settings/integrations/whatsapp/_components/whatsapp-config-form.tsx`)
- `/settings/integrations/whatsapp-inbound` — WhatsApp Inbound Webhook Inspection & Replay Console
- `/whatsapp/console` — Live WhatsApp Chat Console (`src/actions/whatsapp-console.actions.ts`)
- `/whatsapp/catalog` — WhatsApp Product Catalog Manager (`src/app/(dashboard)/whatsapp/catalog/page.tsx`)
- `/settings/email-templates` — Email Templates Directory (`src/app/(dashboard)/settings/email-templates/page.tsx`)

## API & Webhook Endpoints
- `GET /api/webhooks/whatsapp` — Meta Webhook Subscription Verification (`hub.mode`, `hub.verify_token`)
- `POST /api/webhooks/whatsapp` — Meta Inbound Message & Delivery Status Webhook
- `GET /api/track/open/[pixelId]` — Email Open Tracking Pixel Handler
- `GET /api/track/click/[pixelId]` — Email Link Click Tracking Redirect Handler
- `POST /api/webhooks/telephony` — Telephony / Call Dispositions Webhook

## Cron Routes
- `GET /api/cron/payment-reminders` — Payment Due WhatsApp & Email Reminders
- `GET /api/cron/contract-reminders` — Contract Expiry WhatsApp Reminders
- `GET /api/cron/site-visit-reminders` — Site Visit Reminder Alerts
- `GET /api/cron/vendor-reminders` — Vendor Work Order & Assignment Reminders
- `GET /api/cron/guest-reminders` — Event Guest Invitation & RSVP Reminders
- `GET /api/cron/quote-nudge` — Quotation Follow-up Reminders
- `GET /api/cron/whatsapp-inbound-prune` — Inbound Event Log Cleanup Cron
