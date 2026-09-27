# PASSWORD RESET UI FORENSICS (`/reset-password`)

## 1. Screen & Token Verification

The Password Reset interface is implemented in [src/app/(auth)/reset-password/page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(auth)/reset-password/page.tsx) and [src/app/(auth)/reset-password/_components/reset-password-form.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(auth)/reset-password/_components/reset-password-form.tsx).

- **Route Requirement**: `/reset-password?token=XYZ...`
- **Token Validation**: Read from search parameters. If token is missing or expired, an inline error alert is displayed.

---

## 2. Form Fields & Interaction Flow

```
RESET PASSWORD SCREEN (?token=...)
  │
  ├── Token Missing/Invalid ──► Render Error State & "Request new link" button
  │
  └── Token Valid
        │
        ▼
  Input New Password (min 8 chars, uppercase, lowercase, digit)
        │
        ▼
  Input Confirm Password (must match)
        │
        ▼
  Click "Reset password"
        │
        ▼
  Server Action: resetPasswordAction(token, newPassword)
        │
        ▼
  Toast Notification: "Password updated successfully!"
        │
        ▼
  Redirect to /sign-in
```
