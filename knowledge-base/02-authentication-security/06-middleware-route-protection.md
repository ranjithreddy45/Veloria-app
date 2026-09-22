# CHUNK 02-06 — MIDDLEWARE & ROUTE PROTECTION

- **Status**: `CODE VERIFIED`
- **Module**: Authentication & Security
- **Target Path**: `knowledge-base/02-authentication-security/06-middleware-route-protection.md`

---

## 🛡️ Edge Middleware Rule Matrix (`middleware.ts`)

`middleware.ts` runs on the Edge runtime using `auth.config.ts` to inspect incoming request paths and enforce access policies before rendering:

| Route Pattern | Required Role Array | Authentication Behavior | Failed Auth Redirect Target |
|---|---|---|---|
| `/dashboard/*`, `/leads/*`, `/people/*`, `/finance/*` | `INTERNAL_ROLES` (21 Roles) | Session Required + RBAC check (`routePermission()`) | `/sign-in` (Unauthenticated) or `/not-authorized` (Forbidden) |
| `/portal/*` | `PORTAL_ROLES` (`CLIENT`, `ADMIN`, `SUPER_ADMIN`) | Session Required + Client Scope | `/sign-in` or `/not-authorized` |
| `/vendor-portal/*` | `VENDOR_PORTAL_ROLES` (`VENDOR`, `ADMIN`, `SUPER_ADMIN`)| Session Required + Vendor Scope | `/sign-in` or `/not-authorized` |
| `/two-factor` | Any Authenticated User | Owed 2FA Challenge Gate | `/sign-in` |
| `/public/*`, `/pay/*`, `/widget/*` | Public / Unauthenticated | Tokenized URL parameter check | Standard 404 / Invalid Token Page |
| `/api/cron/*` | System (Bearer Token) | Header check against `CRON_SECRET` | HTTP 401 Unauthorized |
| `/api/webhooks/*` | Third-Party Webhook | HMAC Signature / Webhook secret verification | HTTP 403 Forbidden |
