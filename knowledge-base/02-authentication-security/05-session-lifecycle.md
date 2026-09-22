# CHUNK 02-05 — SESSION LIFECYCLE

- **Status**: `CODE VERIFIED`
- **Module**: Authentication & Security
- **Target Path**: `knowledge-base/02-authentication-security/05-session-lifecycle.md`

---

## ⏳ Session Strategy & Lifetime Parameters

Veloria Grand uses **JWT-based Sessions** (`strategy: "jwt"`) signed with `AUTH_SECRET`:

- **Token Lifetime**: 30 Days default max age.
- **Session Hydration**: Server Components and Server Actions retrieve sessions asynchronously via `await auth()`.
- **Session Revalidation Component**: `src/components/auth/session-revalidator.tsx` periodically checks session validity on active browser tabs.

---

## 🔒 Session Payload Contents

The decrypted JWT session token contains the following sanitized identity claims:

```json
{
  "user": {
    "id": "cm7123abc456def789",
    "email": "hr.manager@veloriagrand.com",
    "name": "Ananya Sharma",
    "role": "HR_MANAGER",
    "twoFactorVerified": true
  },
  "expires": "2026-10-22T10:30:00.000Z"
}
```

> [!CAUTION]
> Sensitive fields such as `passwordHash`, `twoFactorSecret`, or recovery codes are **NEVER** stored inside JWT session tokens.
