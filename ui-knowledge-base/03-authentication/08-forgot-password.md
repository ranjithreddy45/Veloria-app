# FORGOT PASSWORD UI FORENSICS (`/forgot-password`)

## 1. Screen Architecture

The Forgot Password UI is implemented in [src/app/(auth)/forgot-password/page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(auth)/forgot-password/page.tsx) and [src/app/(auth)/forgot-password/_components/forgot-password-form.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(auth)/forgot-password/_components/forgot-password-form.tsx).

```
LOGIN (/sign-in) ──► CLICK "Forgot password?" ──► FORGOT PASSWORD SCREEN (/forgot-password)
                                                            │
                                                            ▼
                                                     INPUT EMAIL ADDRESS
                                                            │
                                                            ▼
                                                     SUBMIT FORM
                                                            │
                                                            ▼
                                                   SERVER ACTION DISPATCH
                                                            │
                                                            ▼
                                                  SUCCESS CONFIRMATION STATE
```

---

## 2. Form Fields & Validation

- **Field**: `email`
- **Label**: `Email address`
- **Validation**: `forgotPasswordSchema` (`min(1, "Email is required")`, `.email("Enter a valid email address")`).
- **Submit Button**: `Send reset link` (Renders `Loader2` spinning during transition).

---

## 3. Post-Submission UI Behavior

Upon submitting a valid email:
- The form transitions to a success notification state:
  - Header: `"Check your email"`
  - Description: `"We've sent a password reset link to your email address if an account exists."`
  - Action Button: `"Back to sign in"` linking to `/sign-in`.
