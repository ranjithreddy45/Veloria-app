# AUTHORIZATION & ACCESS DENIED UI

## 1. Authorization vs Authentication

While authentication verifies identity, authorization checks permissions. When a user attempts to access a route or component for which they lack permissions, Veloria Grand presents dedicated authorization error surfaces.

---

## 2. `/not-authorized` Access Denied Screen

Implemented in [src/app/not-authorized/page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/not-authorized/page.tsx).

```
┌──────────────────────────────────────────────────────────┐
│                      [ ShieldAlert ]                     │
│                       Access Denied                      │
│   You don't have permission to access this page. Please  │
│    contact your administrator if you believe this is    │
│                       an error.                          │
│                                                          │
│  [ ← Go to Dashboard ]          [ Sign In ]              │
└──────────────────────────────────────────────────────────┘
```

- **Visual Features**: Red alert badge (`bg-red-50 text-red-500`), bold heading, explanatory body text.
- **Action Controls**:
  - Button 1: `"Go to Dashboard"` linking to `/dashboard`.
  - Button 2: `"Sign In"` linking to `/sign-in`.

---

## 3. UI Element Hiding & Disabling

- **Sidebar Navigation**: Navigation items are filtered based on `user.role` prior to rendering. Non-permitted links are hidden entirely from the DOM.
- **Action Buttons**: Action buttons (e.g., "Delete Lead", "Approve Refund") check permission arrays and render disabled or remain hidden.
