# AUTHENTICATION MANUAL VERIFICATION CHECKLIST

## 1. Verification Items Required for Runtime Validation

Static code forensics has documented the exact implementation structure. The following items require manual browser verification:

| Check ID | Target Verification Item | Expected Manual Test Result | Priority |
|---|---|---|---|
| **MAN-AUTH-01** | Valid Staff Login | Redirects seamlessly to `/dashboard` with session cookies set | High |
| **MAN-AUTH-02** | Invalid Password Attempt | Displays red Sonner toast `"Invalid email or password"` | High |
| **MAN-AUTH-03** | 2FA TOTP Flow | Prompts for 6-digit code on `/two-factor` and verifies correctly | High |
| **MAN-AUTH-04** | Forgot Password Email | Triggers reset email link containing valid reset token | Medium |
| **MAN-AUTH-05** | Reset Password Token Submission | Updates user password and redirects to `/sign-in` | Medium |
| **MAN-AUTH-06** | Session Expiry Intercept | Accessing `/dashboard` after clearing cookie redirects to `/sign-in` | High |
| **MAN-AUTH-07** | Client Sign-Up Flow | Registers new client account and establishes initial portal access | Medium |
| **MAN-AUTH-08** | Mobile Viewport Layout | Ensures 44px touch targets and no horizontal overflow on mobile | Low |
