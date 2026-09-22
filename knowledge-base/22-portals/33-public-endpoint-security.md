# 33 Public Endpoint Hardening & Rate Limits

`CODE VERIFIED`

## Public Endpoint Protection Matrix

| Public Endpoint | Rate Limit | CAPTCHA / Honeypot | Signature Check | Expiration Check |
| :--- | :--- | :--- | :--- | :--- |
| `/api/webforms/[slug]` | 10 req / min per IP | Honeypot Field | N/A | Slug Status Active |
| `/api/payments/create-order` | 20 req / min per IP | N/A | Token Check | Payment Link Active |
| `/api/payments/webhook` | Unlimited | N/A | Razorpay HMAC SHA-256 | N/A |
| `/q/[token]` | 30 req / min per IP | N/A | Token Check | `expiresAt` > Now |
| `/sign/[token]` | 15 req / min per IP | N/A | Token Check | Contract Unlocked |
