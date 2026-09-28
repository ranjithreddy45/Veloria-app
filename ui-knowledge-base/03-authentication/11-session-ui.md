# SESSION BEHAVIOR & UI LIFECYCLE

## 1. Session States & Visual Manifestations

Veloria Grand uses NextAuth JWT sessions (`__Secure-authjs.session-token`).

```
AUTHENTICATED SESSION ──► ACTIVE JWT TOKEN ──► FULL APP SHELL & SIDEBAR RENDERED
      │
      ├── Session Expiration / Invalidation ──► REDIRECT TO /sign-in
      │
      └── Session Update (Role/2FA change) ──► SessionRevalidator TRIPPED
```

---

## 2. Session Lifecycle Matrix

| Session State | UI Behavior | Shell Impact | User Options |
|---|---|---|---|
| **Active / Valid** | Normal app shell, user profile avatar rendered | Access to allowed sub-routes | Navigate, perform actions, Sign Out |
| **Expired Session** | Automatic middleware intercept on next fetch/route | Redirected to `/sign-in?callbackUrl=...` | Re-authenticate |
| **Missing Session** | Direct access to protected route blocked by `middleware.ts` | Redirected to `/sign-in` | Sign In or Sign Up |
| **Partial (2FA Pending)** | Redirected to `/two-factor` screen | Shell blocked completely | Submit 2FA code or Sign Out |
| **Session Revalidation** | `<SessionRevalidator />` triggers `update()` on mount | Ensures fresh headers/avatar sync | Seamless background update |
