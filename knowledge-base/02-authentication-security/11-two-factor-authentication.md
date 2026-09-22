# CHUNK 02-11 — TWO-FACTOR AUTHENTICATION (2FA)

- **Status**: `CODE VERIFIED` | `BRIEF DOCUMENTED`
- **Module**: Authentication & Security
- **Target Path**: `knowledge-base/02-authentication-security/11-two-factor-authentication.md`

---

## 🔐 TOTP 2FA Architecture & Policy (`src/lib/security/two-factor-login.ts`)

Veloria Grand implements a TOTP (Time-based One-Time Password) Two-Factor Authentication system for high-privilege staff roles (`ADMIN`, `SUPER_ADMIN`, `FINANCE`, `HR_MANAGER`).

```
[User Signs In with Password]
             │
             ▼
[auth.ts Checks user.twoFactorEnabled]
             │
             ├──> Enabled: Throws TwoFactorRequiredError -> Redirects to /two-factor
             │
             ▼
[User Inputs 6-Digit TOTP / 10-Char Recovery Code]
             │
             ▼
[verifySecondFactor() in src/lib/security/two-factor-login.ts]
             │
             ├──> Rate Limit Check: Max 5 attempts / min (checkRateLimit)
             ├──> TOTP Code Check: Decrypts TOTP secret -> Calls verifyTotpCode()
             └──> Recovery Code Check: Compares hashed recovery code -> Decrements codes left
             │
             ▼
[Session JWT Hydrated: twoFactorVerified = true -> Access Granted]
```

---

## 🔑 Database Fields & Security Measures

- **Database Fields (`User` Model)**:
  - `twoFactorEnabled`: Boolean flag indicating active 2FA.
  - `twoFactorSecret`: AES-256-GCM encrypted TOTP secret key (`decryptTotpSecret()`).
  - `twoFactorRecoveryCodes`: Array of hashed 10-character emergency recovery codes.
- **Rate Limiting**: Enforces strict limit of **5 attempts per user per minute** (`TWO_FACTOR_ATTEMPT_LIMIT`).
