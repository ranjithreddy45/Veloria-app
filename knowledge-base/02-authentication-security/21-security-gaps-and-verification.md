# CHUNK 02-21 — SECURITY GAPS AND VERIFICATION FINDINGS

- **Status**: `CODE VERIFIED`
- **Module**: Authentication & Security
- **Target Path**: `knowledge-base/02-authentication-security/21-security-gaps-and-verification.md`

---

## 📋 Security Findings Matrix

| Security Area | Status | Evidence | Impact / Risk | Manual Verification Needed |
|---|---|---|---|---|
| **Split NextAuth Edge Architecture** | `VERIFIED` | `auth.config.ts` vs `auth.ts` | High security. Edge middleware prevents unauthorized rendering without DB load. | Verify token expiry on Edge. |
| **TOTP 2FA Enforcement** | `VERIFIED` | `src/lib/security/two-factor-login.ts` | High security. Enforces 5 attempts/min rate limit. | Test recovery code consumption. |
| **Presigned S3 File Uploads** | `VERIFIED` | `src/lib/storage/s3.ts` | High security. Eliminates base64 server body vulnerabilities. | Verify S3 bucket CORS rules. |
| **Google Ads / FB Webhook Verification**| `PARTIALLY VERIFIED` | `src/app/api/webhooks/google-ads` | Moderate risk. Webhook tokens check secret headers, but IP filtering absent. | Test webhook replay protection. |
| **Capacitor Biometric Key Storage** | `VERIFIED` | `src/lib/capacitor/biometric.ts` | High security on native devices using OS Keychain / KeyStore. | Test fallback when biometrics fail. |
