# Phase 5: Master API Index

| Method | Route | Module | Auth | Permission | Dynamic Parameters | Models Affected | External Integration | Status |
|---|---|---|---|---|---|---|---|---|
| POST | `/api/auth/[...nextauth]` | Auth | Public | None | None | `User`, `Account` | NextAuth | IMPLEMENTED |
| POST | `/api/webhooks/razorpay` | Payments | Webhook HMAC | Signature Verified | None | `Payment`, `Invoice` | Razorpay | IMPLEMENTED |
| POST | `/api/webhooks/whatsapp` | Communications | Meta Secret | Token Verified | None | `WhatsAppLog` | Meta Cloud API | IMPLEMENTED |
| POST | `/api/webhooks/meta-ads` | Marketing | Meta App Secret | Token Verified | None | `Lead`, `Campaign` | Facebook Lead Ads | IMPLEMENTED |
| GET | `/api/cron/sla-check` | CRM | Cron Auth Key | Secret Header | None | `Lead`, `SLAViolation` | Internal Cron | IMPLEMENTED |
| GET | `/api/cron/payroll-accrual` | Payroll / GL | Cron Auth Key | Secret Header | None | `HrPayrollRun`, `FinJournalEntry` | Internal Cron | IMPLEMENTED |
| GET | `/api/cron/hold-expiration` | Sales / Booking | Cron Auth Key | Secret Header | None | `PublicHoldToken`, `Booking` | Internal Cron | IMPLEMENTED |
| POST | `/api/v1/integrations/runo/sync` | CRM | API Key | `INTEGRATION_SYNC` | None | `Lead` | Runo Calling API | IMPLEMENTED |
| POST | `/api/v1/integrations/google-ads` | Marketing | OAuth2 Token | `MANAGE_ADS` | None | `AttributionLog` | Google Ads API | IMPLEMENTED |
