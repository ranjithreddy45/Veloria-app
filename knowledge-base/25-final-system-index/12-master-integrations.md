# Phase 12: Master Integration Index

| Integration | Purpose | Module | Direction | Auth Method | Webhook / Cron | Failure Handling | Status |
|---|---|---|---|---|---|---|---|
| **Razorpay** | Online Payment Gateway | Invoicing | Bi-directional | HMAC Secret | `/api/webhooks/razorpay` | Retry queue & log | IMPLEMENTED |
| **AWS S3** | Contract PDFs & Proof Storage | Multi-module | Outbound | AWS IAM Access Keys | Direct SDK Call | Local fallback alert | IMPLEMENTED |
| **Resend** | Transactional Email Delivery | Communications | Outbound | API Key Header | Direct Action Call | Logging & status flag | IMPLEMENTED |
| **Meta WhatsApp** | Customer Alerts & Marketing | Communications | Bi-directional | Bearer Token & Secret | `/api/webhooks/whatsapp` | Delivery status log | IMPLEMENTED |
| **Weflux** | Automated Workflow Triggers | Operations | Outbound | API Key Header | Event Trigger | Alert log | IMPLEMENTED |
| **OpenAI** | AI Lead Scoring & BEO Summary | CRM / Ops | Outbound | Bearer API Key | On-demand Action | Graceful default fallback | IMPLEMENTED |
| **Google Ads API** | Conversion & Campaign Track | Marketing | Inbound | OAuth2 Credentials | Scheduled Sync | Log failure | IMPLEMENTED |
| **Facebook Lead Ads**| Direct Lead Sync | CRM / Marketing | Inbound | App Secret Proof | `/api/webhooks/meta-ads` | Dead-letter queue | IMPLEMENTED |
| **Sentry** | Error & Crash Monitoring | System Architecture | Outbound | DSN Client Token | Runtime Middleware | Local console capture | IMPLEMENTED |
