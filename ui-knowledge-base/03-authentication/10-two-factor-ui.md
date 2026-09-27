# TWO-FACTOR AUTHENTICATION (2FA) UI FORENSICS

## 1. 2FA UI Architecture & Touchpoints

Two-Factor Authentication in Veloria Grand operates across 3 primary UI surfaces:

1. **Authentication Challenge (`/two-factor`)**: Triggered post login when user record has 2FA enabled.
2. **Self-Service Enrollment (`/me/security`)**: QR Code scanning, TOTP validation, recovery code generation.
3. **Role Enforcement Banner (`TwoFactorBanner`)**: Sticky banner reminding enforced roles (`ADMIN`, `FINANCE`, `GENERAL_MANAGER`) to enroll.

---

## 2. Authentication Challenge UI (`/two-factor`)

Defined in [two-factor-challenge-form.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(auth)/two-factor/_components/two-factor-challenge-form.tsx):

- **Header Icon**: `ShieldCheck` in primary tint box.
- **Title**: `"One more step"`
- **Subtitle**: `"Enter the 6-digit code from your authenticator app for [email]."`
- **Input Field**:
  - `id`: `two-factor-code`
  - `type`: `text`
  - `inputMode`: `numeric`
  - `autoComplete`: `one-time-code`
  - `placeholder`: `123456`
  - `tracking`: `tracking-[0.35em]` (spaced characters for legibility)
- **Recovery Fallback Text**: `"Lost your phone? Enter one of your recovery codes (e.g. K7MP3-Q9XZ2) instead."`
- **Submit Action**: `completeTwoFactorChallenge(code)` action.
- **Cancel Action**: `"Sign out"` button calling `signOut({ callbackUrl: "/sign-in" })`.

---

## 3. Role-Based 2FA Banner (`TwoFactorBanner`)

Defined in [two-factor-banner.tsx](file:///Users/fci/Documents/Veloria-app/src/components/security/two-factor-banner.tsx):
- **Display Condition**: Roles requiring 2FA (`ADMIN`, `FINANCE`, `GENERAL_MANAGER`) that have `twoFactorEnabled = false`.
- **Visual Presentation**: Amber warning strip (`bg-amber-50 border-b border-amber-300`).
- **Action**: Button `"Set it up now"` linking to `/me/security`.
- **Dismiss Control**: `X` icon button storing `sessionStorage.setItem("vg:2fa-banner-dismissed", "1")`.
