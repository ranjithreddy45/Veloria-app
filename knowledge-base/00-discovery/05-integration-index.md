# VELORIA GRAND — EXTERNAL INTEGRATIONS & AUTOMATION INDEX

---

## 📌 Integrations Overview

- **Status Label**: `CODE VERIFIED` | `BRIEF DOCUMENTED`
- **External Services Integrated**: **9 Services**
- **Cron Jobs Configured**: **56 Cron Endpoints** (`src/app/api/cron/*`)
- **Webhooks Configured**: **7 Webhook Routes** (`src/app/api/webhooks/*`, `src/app/api/payments/`)

---

## 🔌 External Integration Services

1. **Razorpay Payments**: Online payment checkout, payment links, instant webhook reconciliation (`src/lib/razorpay.ts`).
2. **AWS S3 File Storage**: Presigned URL direct file uploads for contracts, receipts, photos (`src/lib/s3.ts`).
3. **Resend Transactional Email**: Automated transactional email notifications (`src/lib/resend.ts`).
4. **Meta WhatsApp Cloud API**: Automated WhatsApp template triggers & chat sync (`src/lib/whatsapp.ts`).
5. **Runo Telephony**: Automatic call log synchronization & lead disposition (`src/app/api/webhooks/telephony/`).
6. **OpenAI GPT-4**: AI lead quality scoring & customer sentiment analysis (`src/lib/ai/`).
7. **Google Ads Webhook**: Real-time lead capture from Google Ad campaigns (`src/app/api/webhooks/google-ads/`).
8. **Facebook Lead Ads**: Direct lead ingestion from Meta lead forms (`src/app/api/webhooks/facebook-leads/`).
9. **Sentry Error Tracking**: Exception and performance monitoring (`sentry.server.config.ts`).
