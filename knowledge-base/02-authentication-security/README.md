# CHUNK 02 — AUTHENTICATION, SECURITY & SESSION MANAGEMENT

---

## 📌 Chunk Overview

This directory contains **Chunk 02 — Authentication, Security & Session Management** of the permanent Veloria Grand Application Knowledge Base.

---

## 📂 Document Directory

| Document | Title | Description | Status |
|---|---|---|---|
| [`01-authentication-overview.md`](./01-authentication-overview.md) | Authentication Overview | High-level auth architecture, security perimeter, auth vs authorization boundaries | `COMPLETE` |
| [`02-auth-provider-architecture.md`](./02-auth-provider-architecture.md) | Auth Provider Architecture | `auth.ts` vs `auth.config.ts`, Credentials provider with `bcryptjs`, Google OAuth | `COMPLETE` |
| [`03-nextauth-architecture.md`](./03-nextauth-architecture.md) | NextAuth Architecture | Split NextAuth v5 architecture, TypeScript module augmentation, session callbacks | `COMPLETE` |
| [`04-login-flows.md`](./04-login-flows.md) | Login Flows | Step-by-step credentials, 2FA challenge, and native mobile biometric login sequences | `COMPLETE` |
| [`05-session-lifecycle.md`](./05-session-lifecycle.md) | Session Lifecycle | JWT strategy, session payload contents, hydration via `auth()`, session revalidation | `COMPLETE` |
| [`06-middleware-route-protection.md`](./06-middleware-route-protection.md) | Middleware Route Protection | Edge `middleware.ts` rule matrix, role array matching, route permission lookups | `COMPLETE` |
| [`07-server-action-security.md`](./07-server-action-security.md) | Server Action Security | Server action security classification, tracing 10 production server actions in detail | `COMPLETE` |
| [`08-api-security.md`](./08-api-security.md) | API Security | Security classifications for 111 API endpoints, Razorpay HMAC signature verification | `COMPLETE` |
| [`09-role-and-permission-boundary.md`](./09-role-and-permission-boundary.md) | Role & Permission Boundary | Architectural security boundary connecting User -> Role -> Permission -> Resource | `COMPLETE` |
| [`10-resource-level-authorization.md`](./10-resource-level-authorization.md) | Resource-Level Authorization | Resource scoping rules (`where: { employeeId }`, `where: { clientId }`) | `COMPLETE` |
| [`11-two-factor-authentication.md`](./11-two-factor-authentication.md) | Two-Factor Authentication (2FA) | TOTP 2FA engine, AES-256 secret decryption, recovery codes, 5 attempts/min rate limit | `COMPLETE` |
| [`12-biometric-authentication.md`](./12-biometric-authentication.md) | Biometric Authentication | Capacitor 8 native biometrics (`@capgo/capacitor-native-biometric`), OS Keychain | `COMPLETE` |
| [`13-oauth-and-external-login.md`](./13-oauth-and-external-login.md) | OAuth & External Login | Google OAuth provider, account linking via NextAuth PrismaAdapter | `COMPLETE` |
| [`14-portal-authentication.md`](./14-portal-authentication.md) | Portal Authentication | Security boundaries for Client Portal, Vendor Portal, and Guest RSVP app | `COMPLETE` |
| [`15-logout-account-state.md`](./15-logout-account-state.md) | Logout & Account State | `signOut()` session termination, account deactivation handling (`User.status`) | `COMPLETE` |
| [`16-unauthorized-and-error-handling.md`](./16-unauthorized-and-error-handling.md) | Unauthorized & Error Handling | Behavior for invalid passwords, expired sessions, forbidden routes, invalid API keys | `COMPLETE` |
| [`17-security-sensitive-data.md`](./17-security-sensitive-data.md) | Security-Sensitive Data | Inventory of sensitive database fields (`passwordHash`, `twoFactorSecret`, `keyHash`) | `COMPLETE` |
| [`18-security-integrations.md`](./18-security-integrations.md) | Security Integrations | Integration security perimeters for Razorpay, AWS S3, Resend, WhatsApp, Sentry | `COMPLETE` |
| [`19-security-audit-and-monitoring.md`](./19-security-audit-and-monitoring.md) | Security Audit & Monitoring | Audit logging via `ActivityLog` and `ApprovalLog` models | `COMPLETE` |
| [`20-authentication-end-to-end-flows.md`](./20-authentication-end-to-end-flows.md) | Auth End-to-End Flows | Mermaid sequence diagrams tracing credentials login, 2FA, and server actions | `COMPLETE` |
| [`21-security-gaps-and-verification.md`](./21-security-gaps-and-verification.md) | Security Gaps & Verification | Security audit matrix mapping verified mechanisms, risks, and manual tests | `COMPLETE` |
