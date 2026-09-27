# LOGOUT UI FORENSICS

## 1. Logout Triggers & Touchpoints

Logout is initiated from 3 distinct UI locations:

1. **User Profile Menu (Header)**: Dropdown item `"Sign Out"` in [user-nav.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/_components/user-nav.tsx).
2. **2FA Challenge Screen (`/two-factor`)**: Secondary button `"Sign out"` in [two-factor-challenge-form.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(auth)/two-factor/_components/two-factor-challenge-form.tsx).
3. **Session Expiry API Endpoint**: Direct navigation to `/api/auth/clear-session`.

---

## 2. Logout Flow & Execution Trace

```
USER CLICKS "SIGN OUT"
  │
  ▼
Triggers signOutSafely() Action or NextAuth signOut()
  │
  ▼
Clears NextAuth Session Cookies (__Secure-authjs.session-token)
  │
  ▼
Purges Client Cache & React State
  │
  ▼
Executes Hard Window Redirect: window.location.assign("/sign-in")
```

- **Confirmation Dialog**: `NO CONFIRMATION DIALOG`. Logout executes immediately upon clicking "Sign Out".
