# CHUNK 02-08 — API SECURITY

- **Status**: `CODE VERIFIED`
- **Module**: Authentication & Security
- **Target Path**: `knowledge-base/02-authentication-security/08-api-security.md`

---

## 🔐 API Endpoint Security Categories

The 111 API routes under `src/app/api/` enforce 5 distinct security mechanisms:

```
src/app/api/
├── cron/*               --> Bearer Token (Authorization: Bearer <CRON_SECRET>)
├── webhooks/
│   ├── razorpay         --> HMAC SHA256 (X-Razorpay-Signature)
│   ├── google-ads       --> Bearer Webhook Key Header
│   ├── facebook-leads   --> SHA1 HMAC App Secret (X-Hub-Signature)
│   └── whatsapp         --> Meta Verify Token & Secret
├── v1/*                 --> X-API-Key Header (Validated against ApiKey model)
└── portal/*             --> NextAuth JWT Session Cookie
```

---

## 🛡️ Webhook Signature Verification Traces

### Razorpay Webhook Verification (`src/app/api/payments/webhook/route.ts`)
```typescript
import crypto from "crypto";

export async function POST(req: Request) {
  const bodyText = await req.text();
  const signature = req.headers.get("X-Razorpay-Signature");
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  const expectedSignature = crypto
    .createHmac("sha256", secret!)
    .update(bodyText)
    .digest("hex");

  if (expectedSignature !== signature) {
    return new Response(JSON.stringify({ error: "Invalid Signature" }), { status: 403 });
  }
  // Signature verified -> Proceed with payment reconciliation
}
```
