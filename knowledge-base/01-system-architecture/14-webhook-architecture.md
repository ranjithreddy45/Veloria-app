# CHUNK 01-14 — WEBHOOK ARCHITECTURE

- **Status**: `CODE VERIFIED`
- **Module**: System Architecture
- **Target Path**: `knowledge-base/01-system-architecture/14-webhook-architecture.md`

---

## 📌 Webhook Ingestion Pipeline

The application exposes **7 Webhook Handlers** for real-time third-party integrations:

| Webhook Endpoint | External Sender | Signature Verification Method | Primary Database Actions |
|---|---|---|---|
| `/api/payments/webhook` | Razorpay | HMAC SHA256 (`X-Razorpay-Signature`) | Updates `Payment`, `Invoice`, posts GL Journal Entry |
| `/api/webhooks/google-ads` | Google Ads | Bearer Webhook Token | Creates `Lead` and `WidgetInquiry` |
| `/api/webhooks/facebook-leads`| Meta Facebook | SHA1 HMAC App Secret (`X-Hub-Signature`) | Creates `Lead` and `Contact` |
| `/api/webhooks/telephony` | Runo Telephony| API Header Token | Creates `CallLog`, updates `Lead` call disposition |
| `/api/webhooks/whatsapp` | Meta WhatsApp | Meta Verify Token & App Secret | Creates `WhatsAppMessage`, updates delivery status |
| `/api/webhooks/weflux` | Weflux Engine | Webhook Token Header | Triggers automated workflow execution |
