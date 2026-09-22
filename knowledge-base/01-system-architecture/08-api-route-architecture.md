# CHUNK 01-08 — API ROUTE ARCHITECTURE

- **Status**: `CODE VERIFIED`
- **Module**: System Architecture
- **Target Path**: `knowledge-base/01-system-architecture/08-api-route-architecture.md`

---

## 📌 API Endpoints Structure & Taxonomy

The application defines **111 API Route Endpoints** located in `src/app/api/`:

```
src/app/api/
├── cron/               # 56 Cron Automation Endpoints (Token Authenticated)
├── webhooks/           # 7 External Webhook Handlers (Signature Authenticated)
│   ├── google-ads/     # Google Ads Inbound Lead Webhook
│   ├── facebook-leads/ # Meta Facebook Lead Form Webhook
│   ├── telephony/      # Runo Telephony Call Sync Webhook
│   ├── weflux/         # Weflux External Automation Webhook
│   └── whatsapp/       # Meta WhatsApp Inbound Message Webhook
├── payments/           # Razorpay Order Creation & Webhook Handler
├── upload/             # Direct AWS S3 Presigned URL Token Generator
└── v1/                 # Public Key-Authenticated REST API endpoints
```

---

## 🔒 Security & Authentication Mechanisms

1. **Cron Endpoints (`src/app/api/cron/*`)**: Protected by Bearer token authorization header checked against `CRON_SECRET` environment variable.
2. **Payment Webhook (`src/app/api/payments/webhook`)**: Validates HMAC SHA256 signature (`X-Razorpay-Signature`) computed over raw request body using `RAZORPAY_WEBHOOK_SECRET`.
3. **Public REST APIs (`src/app/api/v1/*`)**: Authenticated via `ApiKey` model tokens passed in `X-API-Key` headers.

---

## 📝 REST API Response Format

All API routes emit standardized JSON responses:
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "timestamp": "2026-09-22T10:30:00.000Z"
}
```
