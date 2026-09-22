# 13 Webhooks & Security

`CODE VERIFIED`

- **GET Verification**: Subscription verified via `hub.verify_token` against `WhatsAppConfig.verifyToken` or `WHATSAPP_VERIFY_TOKEN`.
- **POST Security**: Timing-safe HMAC SHA-256 verification (`crypto.timingSafeEqual`) checking `X-Hub-Signature-256` against `WhatsAppConfig.appSecret` or `WHATSAPP_APP_SECRET`.
- **Audit Logging**: Every POST request is saved into `WhatsAppInboundEvent` before signature verification, guaranteeing zero silent dropped webhooks.
