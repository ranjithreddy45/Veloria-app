# 03 Authentication Mechanisms & Session Controls

`CODE VERIFIED`

## Authentication Overview

Veloria Grand utilizes two primary authentication paradigms across its portal ecosystem:

1. **Session-Based NextAuth Authentication (Stateful/Cookie-based)**:
   - Used for `/portal/*` (Client Portal) and `/vendor-portal/*` (Vendor Portal).
   - Authenticated via HTTP-only session cookies managed by NextAuth v5 (`auth()`).
   - Session tokens contain `userId`, `email`, `role`, and optional `vendorId`/`contactId`.

2. **Tokenized Cryptographic Link Authentication (Stateless/URL-based)**:
   - Used for `/q/[token]`, `/pay/[token]`, `/sign/[token]`, `/vendor-confirm/[token]`, `/rsvp/[token]`, `/hold/[token]`.
   - High-entropy random hex or UUID tokens stored in database with explicit expiration timestamps (`expiresAt`).
   - Validated per request without creating a persistent NextAuth session.

---

## Authentication Flow Matrix

| Portal / Experience | Login Entry Point | Credential Type | Session Handler | Expiry / Idle Behavior | Password Reset Flow |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Client Portal** | `/sign-in` or `/portal/activate` | Email/Password or Activation Token | NextAuth JWT / Cookie | Session cookie max-age (30 days) | `/forgot-password` -> Reset Email |
| **Vendor Portal** | `/sign-in` or `/vendor-activate` | Email/Password or Activation Token | NextAuth JWT / Cookie | Session cookie max-age (30 days) | `/forgot-password` -> Reset Email |
| **Guest Experience** | `/app` or `/app/welcome` | Guest Token / Public Cookie | Local Storage / Session | Persistent local state | N/A |
| **Tokenized Link** | Direct URL click | URL Token Parameter | Action / Route Lookup | Validated against `expiresAt` | Token regeneration via Server Action |
