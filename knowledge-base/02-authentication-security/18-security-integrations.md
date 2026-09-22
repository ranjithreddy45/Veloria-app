# CHUNK 02-18 — SECURITY INTEGRATIONS

- **Status**: `CODE VERIFIED`
- **Module**: Authentication & Security
- **Target Path**: `knowledge-base/02-authentication-security/18-security-integrations.md`

---

## 🔌 Integration Security Perimeters

- **Razorpay**: HMAC SHA256 signature verification over raw request body using `RAZORPAY_WEBHOOK_SECRET` (`src/app/api/payments/webhook/route.ts`).
- **AWS S3**: Time-limited (15-minute) signed PUT URLs (`src/lib/storage/s3.ts`). AWS IAM credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) remain strictly server-side.
- **Resend**: HTTPS REST calls using `RESEND_API_KEY`.
- **Meta WhatsApp Cloud API**: Permanent Bearer Token authentication (`WHATSAPP_TOKEN`) with inbound verify token matching (`src/lib/integrations/whatsapp.ts`).
- **Sentry**: DSN endpoint with automatic PII data scrubbing (`sentry.server.config.ts`).
