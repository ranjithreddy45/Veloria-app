# Phase 02: Session & Auth Shell Integration

## 1. Shell Session Handling
- `useCurrentUser()` hook fetches session data.
- Unauthenticated requests to dashboard routes are intercepted by Next.js Edge middleware (`src/middleware.ts`) and redirected to `/login`.
