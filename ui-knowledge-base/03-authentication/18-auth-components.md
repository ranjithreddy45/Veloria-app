# REUSABLE AUTHENTICATION UI COMPONENTS

## 1. Component Inventory

| Component ID | Component Name | Source File | Purpose | Props |
|---|---|---|---|---|
| **AUTH-COMP-01** | `SignInForm` | [sign-in-form.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(auth)/sign-in/_components/sign-in-form.tsx) | Primary sign-in form with email/password inputs | None |
| **AUTH-COMP-02** | `SignUpForm` | [sign-up-form.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(auth)/sign-up/_components/sign-up-form.tsx) | Client self-registration form | None |
| **AUTH-COMP-03** | `ForgotPasswordForm` | [forgot-password-form.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(auth)/forgot-password/_components/forgot-password-form.tsx) | Password reset email solicitation form | None |
| **AUTH-COMP-04** | `ResetPasswordForm` | [reset-password-form.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(auth)/reset-password/_components/reset-password-form.tsx) | New password entry form | `{ token: string }` |
| **AUTH-COMP-05** | `TwoFactorChallengeForm` | [two-factor-challenge-form.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(auth)/two-factor/_components/two-factor-challenge-form.tsx) | 6-digit TOTP / recovery code entry form | `{ email: string }` |
| **AUTH-COMP-06** | `TwoFactorBanner` | [two-factor-banner.tsx](file:///Users/fci/Documents/Veloria-app/src/components/security/two-factor-banner.tsx) | Sticky reminder banner for roles requiring 2FA | None |
| **AUTH-COMP-07** | `TwoFactorGate` | [two-factor-gate.tsx](file:///Users/fci/Documents/Veloria-app/src/components/security/two-factor-gate.tsx) | Server gate rendering 2FA challenge redirect or banner | None |
| **AUTH-COMP-08** | `SessionRevalidator` | [session-revalidator.tsx](file:///Users/fci/Documents/Veloria-app/src/components/auth/session-revalidator.tsx) | Triggers session `update()` on protected shell mount | None |
