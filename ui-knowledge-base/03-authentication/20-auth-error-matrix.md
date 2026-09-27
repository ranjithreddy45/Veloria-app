# AUTHENTICATION ERROR MATRIX

## 1. Comprehensive Verified Error Matrix

| Scenario | UI Component | Displayed Message / State | Recovery Action | Target Destination |
|---|---|---|---|---|
| **Empty Email** | `SignInForm` | `"Email is required"` | Type email address | Stay on `/sign-in` |
| **Invalid Email Format** | `SignInForm` | `"Enter your full email address..."` | Correct email formatting | Stay on `/sign-in` |
| **Empty Password** | `SignInForm` | `"Password is required"` | Type password | Stay on `/sign-in` |
| **Wrong Password** | `SignInForm` | `"Invalid email or password"` | Retry or use Forgot Password | Stay on `/sign-in` |
| **Non-Existent User** | `SignInForm` | `"Invalid email or password"` | Check email or Sign Up | Stay on `/sign-in` |
| **Deactivated User** | `SignInForm` | `"Your account has been deactivated."` | Contact Administrator | Stay on `/sign-in` |
| **Wrong 2FA Code** | `TwoFactorChallengeForm` | `"Invalid authentication code"` | Re-enter 6-digit TOTP | Stay on `/two-factor` |
| **Expired Reset Token** | `ResetPasswordForm` | `"Invalid or expired token"` | Request new password reset link | `/forgot-password` |
| **Mismatched Passwords** | `SignUpForm` / `ResetPasswordForm` | `"Passwords do not match"` | Re-type matching passwords | Current form |
| **Forbidden Route Attempt** | `NotAuthorizedPage` | `"Access Denied: You don't have permission"` | Return to Dashboard | `/dashboard` |
