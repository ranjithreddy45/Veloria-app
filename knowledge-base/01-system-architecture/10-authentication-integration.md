# CHUNK 01-10 — AUTHENTICATION INTEGRATION ARCHITECTURE

- **Status**: `CODE VERIFIED`
- **Module**: System Architecture
- **Target Path**: `knowledge-base/01-system-architecture/10-authentication-integration.md`

---

## 📌 NextAuth v5 Split Architecture

Veloria Grand uses **NextAuth v5 (`5.0.0-beta.30`)** configured with a **Split Architecture** to maintain Edge compatibility:

```
auth.config.ts (Edge Safe Configuration)
  └── Lightweight JWT check, Route authorization callbacks
  └── No Prisma imports, No bcryptjs imports
  └── Consumed by middleware.ts (Runs at Vercel Edge / Cloudflare Workers)

auth.ts (Full Node.js Engine)
  └── Implements Prisma Adapter (@auth/prisma-adapter)
  └── Password hashing via bcryptjs (3.0.3)
  └── Credentials Provider & OAuth Providers
  └── Consumed by Server Components & Server Actions
```

---

## 🔑 Authentication Capabilities

1. **Credentials Login**: Email & password authentication with `bcryptjs` hash verification (`auth.ts`).
2. **Two-Factor Authentication (2FA)**: Time-based One-Time Password (TOTP) supported via `otplib` and QR code rendering (`qrcode`).
3. **Session Tokens**: JWT session tokens encrypted with `NEXTAUTH_SECRET`, storing `userId`, `email`, `role`, and `name`.
4. **Native Biometric Login**: Capacitor app integrates `@capgo/capacitor-native-biometric` for Face ID / Touch ID hardware authentication.
