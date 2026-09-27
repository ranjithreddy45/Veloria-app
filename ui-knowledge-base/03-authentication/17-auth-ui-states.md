# AUTHENTICATION UI STATES INVENTORY

## 1. Supported UI State Matrix

| State Identifier | State Name | Visual Representation | Trigger / Condition |
|---|---|---|---|
| **AUTH-STATE-01** | `INITIAL` | Empty form inputs, active submit button | Page load on `/sign-in` |
| **AUTH-STATE-02** | `LOADING` | `Loader2` animated spinner, disabled inputs | Form submission in progress |
| **AUTH-STATE-03** | `VALIDATING` | Red borders on inputs, sub-text errors | Client-side Zod validation failure |
| **AUTH-STATE-04** | `SUCCESS` | Toast message, window location redirect | Valid credentials & session issued |
| **AUTH-STATE-05** | `INVALID` | Red toast notification (`"Invalid email or password"`) | Wrong email or password |
| **AUTH-STATE-06** | `ERROR` | Red toast notification (`"Unexpected server error"`) | Backend database exception |
| **AUTH-STATE-07** | `LOCKED` | Toast notification (`"Account locked"` if active) | Rate limit or security lockout |
| **AUTH-STATE-08** | `EXPIRED` | Middleware redirect to `/sign-in` | JWT session token expired |
| **AUTH-STATE-09** | `UNAUTHORIZED` | Redirect to `/sign-in` | Attempting to access protected route |
| **AUTH-STATE-10** | `FORBIDDEN` | `/not-authorized` page with ShieldAlert | Accessing route without role permission |
| **AUTH-STATE-11** | `DISABLED` | Toast notification (`"Account deactivated"`) | `user.isActive === false` |
| **AUTH-STATE-12** | `REDIRECTING` | Full window location transition | Navigation to `/dashboard`, `/portal`, `/vendor-portal` |
