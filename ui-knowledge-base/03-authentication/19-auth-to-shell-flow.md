# AUTHENTICATION TO APPLICATION SHELL HANDOFF

## 1. Handshake & State Transition

Cross-referencing **Phase 02 — Global Application Shell** (`ui-knowledge-base/02-global-shell/`), this document details the exact technical handshake between authentication completion and shell mount.

```
[1] AUTHENTICATION COMPLETE (auth.actions.ts)
         │
         ▼
[2] NEXTAUTH ISSUES JWT COOKIE (__Secure-authjs.session-token)
         │
         ▼
[3] CLIENT EXECUTES window.location.assign("/dashboard")
         │
         ▼
[4] MIDDLEWARE INTERCEPT (middleware.ts)
    Reads JWT token from cookie, verifies session, passes request
         │
         ▼
[5] DASHBOARD SHELL MOUNTS (src/app/(dashboard)/layout.tsx)
         │
         ├── Renders AppSidebar with user-role filtered menu items
         ├── Renders Header with UserNav avatar & badge
         └── Mounts <SessionRevalidator /> to trigger update() and refresh RSC cache
```
