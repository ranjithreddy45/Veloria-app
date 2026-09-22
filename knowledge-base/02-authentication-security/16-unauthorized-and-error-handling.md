# CHUNK 02-16 — UNAUTHORIZED & ERROR HANDLING

- **Status**: `CODE VERIFIED`
- **Module**: Authentication & Security
- **Target Path**: `knowledge-base/02-authentication-security/16-unauthorized-and-error-handling.md`

---

## 🛑 Unauthorized Request Handling & Redirect Behavior

| Failure Scenario | Intercepting Layer | Action / HTTP Response | User Experience / UI Message |
|---|---|---|---|
| **Invalid Password** | `auth.ts` (Credentials) | Returns `null` in `authorize()` | Form error: "Invalid email or password" |
| **Expired / Missing Session** | `middleware.ts` | Redirects to `/sign-in` | Browser redirected to login screen |
| **Forbidden Role / Route** | `middleware.ts` | Redirects to `/not-authorized` | Displays "403 Forbidden: Access Denied" page |
| **Server Action Perm Denied** | Server Action (`src/actions/*`) | Returns `{ success: false, error: "Forbidden" }` | Toast alert: "Insufficient permissions" |
| **Invalid API Key Header** | API Route (`src/app/api/v1/*`) | HTTP 401 Unauthorized | JSON: `{ "error": "Invalid API Key" }` |
| **Invalid Webhook HMAC** | Webhook Route (`src/app/api/*`) | HTTP 403 Forbidden | JSON: `{ "error": "Invalid Signature" }` |
| **Exceeded 2FA Attempts** | `src/lib/security/two-factor-login.ts` | Rate-limited object `{ ok: false, reason: "rate_limited" }` | Form error: "Too many failed 2FA attempts. Retry in 60s" |
