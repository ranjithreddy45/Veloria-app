# Phase 02: User Account Menu

## 1. User Dropdown Menu
- Located in sidebar footer and header avatar dropdown.
- Displays user full name, email, avatar image, and assigned role badge.
- Options:
  1. "My Profile": Navigates to `/hr/my-profile` or `/me/attendance`.
  2. "Security & 2FA": Navigates to `/me/security`.
  3. "Sign Out": Triggers `signOutSafely()` client-side authentication purge and redirects to `/login`.
