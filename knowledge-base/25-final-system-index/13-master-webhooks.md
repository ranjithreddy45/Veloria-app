# Phase 13: Master Webhook Index

| Endpoint | Provider | Event | Auth / Signature | Handler File | Affected Models | Idempotency | Status |
|---|---|---|---|---|---|---|---|
| `/api/webhooks/razorpay` | Razorpay | `payment.captured`, `payment.failed` | HMAC-SHA256 (`x-razorpay-signature`) | `src/app/api/webhooks/razorpay/route.ts` | `Payment`, `Invoice`, `FinJournalEntry` | Razorpay Event ID check | IMPLEMENTED |
| `/api/webhooks/whatsapp` | Meta Cloud API | `message.received`, `message.status` | Meta Verify Token / App Secret | `src/app/api/webhooks/whatsapp/route.ts` | `WhatsAppLog` | WMID Deduplication | IMPLEMENTED |
| `/api/webhooks/meta-ads` | Meta / Facebook | `leadgen` | SHA256 App Secret Signature | `src/app/api/webhooks/meta-ads/route.ts` | `Lead`, `AttributionLog` | Lead ID Deduplication | IMPLEMENTED |
