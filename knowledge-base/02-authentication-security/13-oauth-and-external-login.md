# CHUNK 02-13 — OAUTH & EXTERNAL LOGIN

- **Status**: `CODE VERIFIED`
- **Module**: Authentication & Security
- **Target Path**: `knowledge-base/02-authentication-security/13-oauth-and-external-login.md`

---

## 🌐 Google OAuth Provider Integration

Google OAuth is configured in `auth.ts` via NextAuth's `Google` provider:

```typescript
Google({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
})
```

- **Account Linking**: The NextAuth `PrismaAdapter` automatically links Google OAuth accounts to existing `User` records matching the verified Google email address.
- **Other Providers (Apple, Microsoft)**: `NOT IMPLEMENTED / NOT FOUND IN CODEBASE`.
