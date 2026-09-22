# CHUNK 01-19 — ENVIRONMENT CONFIGURATION

- **Status**: `CODE VERIFIED`
- **Module**: System Architecture
- **Target Path**: `knowledge-base/01-system-architecture/19-environment-configuration.md`

---

## 🔑 Environment Variable Inventory

Below is the complete inventory of environment variables required by Veloria Grand (secret values sanitized):

| Variable Name | Purpose / Scope | Required / Optional | Subsystem |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL Connection String | **Required** | Prisma ORM & Database |
| `NEXTAUTH_SECRET` | Secret key for encrypting NextAuth JWT session tokens | **Required** | Authentication |
| `NEXTAUTH_URL` | Canonical public URL of the application | **Required** | Authentication |
| `RAZORPAY_KEY_ID` | Razorpay API Key ID | **Required** | Payments Integration |
| `RAZORPAY_KEY_SECRET` | Razorpay API Key Secret | **Required** | Payments Integration |
| `RAZORPAY_WEBHOOK_SECRET` | Secret key for verifying Razorpay HMAC signatures | **Required** | Payments Integration |
| `AWS_ACCESS_KEY_ID` | AWS S3 Access Key ID | **Required** | S3 File Storage |
| `AWS_SECRET_ACCESS_KEY` | AWS S3 Secret Access Key | **Required** | S3 File Storage |
| `AWS_S3_BUCKET` | AWS S3 Bucket Name | **Required** | S3 File Storage |
| `AWS_REGION` | AWS Data Center Region (e.g. `ap-south-1`) | **Required** | S3 File Storage |
| `RESEND_API_KEY` | Resend API Key for dispatching emails | **Required** | Transactional Email |
| `WHATSAPP_TOKEN` | Meta WhatsApp Cloud API Permanent Access Token | **Required** | WhatsApp Messaging |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta WhatsApp Phone Number ID | **Required** | WhatsApp Messaging |
| `RUNO_API_KEY` | Runo Telephony API Secret Key | Optional | Telephony Webhooks |
| `OPENAI_API_KEY` | OpenAI API Key for GPT-4 Lead Scoring | **Required** | AI Lead Scoring |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for client error tracking | Optional | Sentry Monitoring |
| `SENTRY_AUTH_TOKEN` | Sentry CLI Auth Token for uploading source maps | Optional | Sentry Monitoring |
| `CRON_SECRET` | Secret token for securing Bearer auth on cron routes | **Required** | Cron Automations |
