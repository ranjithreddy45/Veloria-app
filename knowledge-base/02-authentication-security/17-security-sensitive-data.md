# CHUNK 02-17 — SECURITY-SENSITIVE DATA

- **Status**: `CODE VERIFIED`
- **Module**: Authentication & Security
- **Target Path**: `knowledge-base/02-authentication-security/17-security-sensitive-data.md`

---

## 🔑 Sensitive Database Fields Inventory

Below is the complete inventory of security-sensitive fields stored in `prisma/schema.prisma` (secret values omitted):

| Database Model | Field Name | Storage / Hashing Mechanism | Access & Encryption Scope |
|---|---|---|---|
| `User` | `passwordHash` | `bcryptjs` 10-salt rounds hash | Write-only during password update; checked via `bcryptjs.compare()` |
| `User` | `twoFactorSecret` | AES-256-GCM encrypted string | Decrypted in memory via `decryptTotpSecret()` during 2FA challenge |
| `User` | `twoFactorRecoveryCodes` | SHA-256 hashed string array | Compared via `safeEqualHex()` during recovery code authentication |
| `ApiKey` | `keyHash` | SHA-256 key hash | Checked against incoming `X-API-Key` header hash |
| `Session` | `sessionToken` | Encrypted JWT token | Decrypted via `AUTH_SECRET` in `auth.ts` |
