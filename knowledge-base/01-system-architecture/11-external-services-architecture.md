# CHUNK 01-11 — EXTERNAL SERVICES ARCHITECTURE

- **Status**: `CODE VERIFIED` | `BRIEF DOCUMENTED`
- **Module**: System Architecture
- **Target Path**: `knowledge-base/01-system-architecture/11-external-services-architecture.md`

---

## 🔌 Integration Matrix

Below is the complete technical architectural summary of all 9 external service integrations:

| Integration Service | Helper File Location | Auth Credentials Required | Database Impact | Error Handling Strategy |
|---|---|---|---|---|
| **Razorpay Payments** | `src/lib/payments/razorpay-creds.ts` | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Updates `Payment`, `Invoice`, `FinJournalEntry` | Retries on webhook; logs error to Sentry |
| **AWS S3 File Storage**| `src/lib/storage/s3.ts` | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET` | Stores object keys in `receiptUrl`, `contractUrl` | Presigned URL fallback; S3 error logs |
| **Resend Email** | `src/lib/email.ts` | `RESEND_API_KEY` | Updates `Notification` log status | Graceful failover; logs dispatch status |
| **Meta WhatsApp API** | `src/lib/integrations/whatsapp.ts` | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Creates `WhatsAppMessage` audit records | Asynchronous dispatch; API error logging |
| **Runo Telephony** | `src/lib/telephony.ts` | `RUNO_API_KEY` | Creates `CallLog`, updates `Lead` disposition | Inbound webhook verification; Sentry trace |
| **OpenAI GPT-4** | `src/actions/ai.actions.ts` | `OPENAI_API_KEY` | Updates `Lead.score`, `aiQualityTier` | Fallback to rule-based scoring algorithm |
| **Google Ads Webhook** | `src/app/api/webhooks/google-ads/`| Google Ads Webhook Token | Creates `Lead` and `WidgetInquiry` records | Rejects bad payloads with HTTP 400 |
| **Facebook Lead Ads** | `src/app/api/webhooks/facebook-leads/`| Meta App Secret & Verify Token | Creates `Lead` records | Rejects unverified signatures with HTTP 403 |
| **Sentry Monitoring** | `sentry.server.config.ts` | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | Reads stack traces across Edge/Server/Client | Non-blocking exception capture |
