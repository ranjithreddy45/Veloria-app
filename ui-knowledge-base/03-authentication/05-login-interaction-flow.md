# LOGIN INTERACTION FLOW & TRACE

## 1. End-to-End Interaction Trace

```
USER
  │
  ▼
[1] Type Email & Password on /sign-in
  │
  ▼
[2] Click "Sign In" Submit Button
  │
  ▼
[3] Client Validation (signInSchema via Zod)
  ├── Fail ──► Display Error Message & Stop
  └── Pass
        │
        ▼
[4] Invoke Server Action: signInWithCredentials(formData)
    (src/actions/auth.actions.ts)
        │
        ▼
[5] Execute NextAuth signIn("credentials", formData)
    (auth.ts)
        │
        ▼
[6] Verify Password via bcryptjs & Fetch User Record
    (prisma.user.findUnique)
        │
        ├─► Invalid Credentials ──► Return { success: false, error: "Invalid credentials" }
        │
        └─► Valid Credentials
              │
              ▼
[7] Evaluate Two-Factor Authentication Status
    ├── 2FA Enabled ──► Set user.twoFactorPending = true
    │                  Return { success: true, twoFactorPending: true }
    │                  UI Redirects to /two-factor
    │
    └── 2FA Disabled / Cleared ──► Issue JWT Session Cookie (__Secure-authjs.session-token)
                                 Determine Target Shell:
                                 - Staff / Admin ──► /dashboard
                                 - Client ──► /portal
                                 - Vendor ──► /vendor-portal
                                 Return { success: true, redirectTo: "..." }
                                 UI Executes window.location.assign(redirectTo)
```

---

## 2. Codebase Reference Map

- **Form Handler**: `onSubmit` in [sign-in-form.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(auth)/sign-in/_components/sign-in-form.tsx)
- **Server Action**: `signInWithCredentials()` in [auth.actions.ts](file:///Users/fci/Documents/Veloria-app/src/actions/auth.actions.ts)
- **Auth Provider**: `NextAuth()` configuration in [auth.ts](file:///Users/fci/Documents/Veloria-app/auth.ts) and [auth.config.ts](file:///Users/fci/Documents/Veloria-app/auth.config.ts)
- **Session Revalidator**: `<SessionRevalidator />` in [session-revalidator.tsx](file:///Users/fci/Documents/Veloria-app/src/components/auth/session-revalidator.tsx)
