# CHUNK 02-15 — LOGOUT & ACCOUNT STATE

- **Status**: `CODE VERIFIED`
- **Module**: Authentication & Security
- **Target Path**: `knowledge-base/02-authentication-security/15-logout-account-state.md`

---

## 🚪 Session Termination & Invalidation

1. **Logout Action**: Invoking `signOut()` in `auth.ts` clears the session JWT cookie (`__Secure-authjs.session-token`).
2. **Account Deactivation**: Setting `User.status = "DISABLED"` or `User.isInactive = true` in PostgreSQL immediately invalidates authorization callbacks during subsequent token refresh attempts.
