# PHASE 03 — COMPLETE AUTHENTICATION UI FORENSIC REPORT

## 1. Execution Summary

- **Phase**: `PHASE 03 — COMPLETE AUTHENTICATION UI FORENSICS`
- **Status**: COMPLETE & VERIFIED
- **Target Folder**: `ui-knowledge-base/03-authentication/`
- **Total Markdown Files Generated**: 25 files
- **Source Modifications Made**: 0 (Strict documentation rule preserved)

---

## 2. Answers to Phase 03 Completion Criteria

1. **How does a user log in?**
   - Via `/sign-in` using email and password, submitting to `signInWithCredentials` server action backed by NextAuth credentials provider.
2. **What fields exist?**
   - `email` (text/email), `password` (password with eye visibility toggle), `two-factor-code` (numeric 6-digit text).
3. **What validation exists?**
   - Client-side and server-side Zod validation (`signInSchema`, `signUpSchema`, `forgotPasswordSchema`, `resetPasswordSchema`).
4. **What happens on success?**
   - Session issued; user role evaluated; client redirected to `/dashboard` (staff), `/portal` (client), or `/vendor-portal` (vendor).
5. **What happens on failure?**
   - Toast notification displaying error message (`"Invalid email or password"`) while remaining on `/sign-in`.
6. **How does the session connect to the shell?**
   - NextAuth HTTP-only JWT session cookie (`__Secure-authjs.session-token`) read by `middleware.ts` and `<SessionRevalidator />` in `(dashboard)/layout.tsx`.
7. **How does 2FA work in the UI?**
   - 2FA pending flag redirects user to `/two-factor` challenge form soliciting 6-digit TOTP or backup recovery code.
8. **How does password recovery work?**
   - `/forgot-password` solicits email; dispatches reset link with token; `/reset-password?token=...` solicits new password.
9. **How does logout work?**
   - UserNav or 2FA challenge sign-out button invokes `signOutSafely()` or NextAuth `signOut()`, clearing cookies and executing hard redirect to `/sign-in`.
10. **What happens when a session expires?**
    - Middleware intercepts request to protected routes and redirects to `/sign-in`.
11. **What does unauthorized look like?**
    - Redirect to `/sign-in`.
12. **What does forbidden look like?**
    - Render of `/not-authorized` page displaying ShieldAlert icon, "Access Denied" message, and action buttons.
13. **How are roles reflected after login?**
    - Roles dictate landing workspace (`/dashboard`, `/portal`, `/vendor-portal`) and filter AppSidebar navigation menu items.
14. **How do portal authentication flows differ?**
    - Client/Vendor portals use full session login or tokenized invite links (`/portal?token=...`); unauthenticated public links (`/q/[token]`, `/sign/[token]`, `/pay/[token]`) rely solely on URL tokens.
15. **Which authentication behaviors require manual verification?**
    - Verified in `23-manual-verification.md` (e.g. live TOTP app code generation, live password reset email dispatch).
