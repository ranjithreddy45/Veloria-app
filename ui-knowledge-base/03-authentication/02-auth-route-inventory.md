# AUTHENTICATION ROUTE INVENTORY

## 1. Complete Authentication Route Map

The Veloria Grand codebase exposes 7 primary authentication UI routes and 2 core API authentication endpoints.

| Route Identifier | URL Path | Source File | Layout Wrapper | Target Audience | Auth Requirement |
|---|---|---|---|---|---|
| **AUTH-SCREEN-0001** | `/sign-in` | [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(auth)/sign-in/page.tsx) | `(auth)/layout.tsx` | All Users (Staff, Client, Vendor) | Unauthenticated |
| **AUTH-SCREEN-0002** | `/sign-up` | [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(auth)/sign-up/page.tsx) | `(auth)/layout.tsx` | New Clients | Unauthenticated |
| **AUTH-SCREEN-0003** | `/forgot-password` | [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(auth)/forgot-password/page.tsx) | `(auth)/layout.tsx` | All Users | Unauthenticated |
| **AUTH-SCREEN-0004** | `/reset-password` | [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(auth)/reset-password/page.tsx) | `(auth)/layout.tsx` | Users with Reset Token | Unauthenticated (Token Required) |
| **AUTH-SCREEN-0005** | `/two-factor` | [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(auth)/two-factor/page.tsx) | `(auth)/layout.tsx` | Users in 2FA Challenge | Partially Authenticated (`twoFactorPending`) |
| **AUTH-SCREEN-0006** | `/me/security` | [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/me/security/page.tsx) | `(dashboard)/layout.tsx` | Authenticated Staff / Users | Authenticated Session Required |
| **AUTH-SCREEN-0007** | `/not-authorized` | [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/not-authorized/page.tsx) | Standalone Root | All Users | Any (Renders Access Denied UI) |
| **AUTH-ENDPOINT-0001** | `/api/auth/[...nextauth]` | [route.ts](file:///Users/fci/Documents/Veloria-app/src/app/api/auth/[...nextauth]/route.ts) | N/A (API Route) | System / NextAuth | Standard NextAuth Handler |
| **AUTH-ENDPOINT-0002** | `/api/auth/clear-session` | [route.ts](file:///Users/fci/Documents/Veloria-app/src/app/api/auth/clear-session/route.ts) | N/A (API Route) | System / Logout | Session Termination Handler |

---

## 2. Route Inventory Detailed Breakdowns

### AUTH-SCREEN-0001: `/sign-in`
- **Route**: `/sign-in`
- **Component**: `SignInPage` (`src/app/(auth)/sign-in/page.tsx`) rendering `SignInForm` (`src/app/(auth)/sign-in/_components/sign-in-form.tsx`).
- **Layout**: `(auth)/layout.tsx` (Glassmorphic authentication shell).
- **Purpose**: Authenticates registered users via email and password credentials.
- **Audience**: Staff/Employees, Clients, Vendors.
- **State**: Unauthenticated.
- **Status**: Implemented & Production Active.

### AUTH-SCREEN-0002: `/sign-up`
- **Route**: `/sign-up`
- **Component**: `SignUpPage` (`src/app/(auth)/sign-up/page.tsx`) rendering `SignUpForm` (`src/app/(auth)/sign-up/_components/sign-up-form.tsx`).
- **Layout**: `(auth)/layout.tsx`.
- **Purpose**: Self-registration interface creating `CLIENT` role users.
- **Audience**: Prospective or existing Clients.
- **State**: Unauthenticated.
- **Status**: Implemented & Production Active.

### AUTH-SCREEN-0003: `/forgot-password`
- **Route**: `/forgot-password`
- **Component**: `ForgotPasswordPage` (`src/app/(auth)/forgot-password/page.tsx`) rendering `ForgotPasswordForm` (`src/app/(auth)/forgot-password/_components/forgot-password-form.tsx`).
- **Layout**: `(auth)/layout.tsx`.
- **Purpose**: Solicit user email to dispatch a secure password reset link/token.
- **Audience**: All users who have forgotten their password.
- **State**: Unauthenticated.
- **Status**: Implemented & Production Active.

### AUTH-SCREEN-0004: `/reset-password`
- **Route**: `/reset-password`
- **Component**: `ResetPasswordPage` (`src/app/(auth)/reset-password/page.tsx`) rendering `ResetPasswordForm` (`src/app/(auth)/reset-password/_components/reset-password-form.tsx`).
- **Layout**: `(auth)/layout.tsx`.
- **Purpose**: Solicit new password and confirm password using `?token=` query parameter.
- **Audience**: Users completing password recovery.
- **State**: Unauthenticated (Validated via Token).
- **Status**: Implemented & Production Active.

### AUTH-SCREEN-0005: `/two-factor`
- **Route**: `/two-factor`
- **Component**: `TwoFactorChallengePage` (`src/app/(auth)/two-factor/page.tsx`) rendering `TwoFactorChallengeForm` (`src/app/(auth)/two-factor/_components/two-factor-challenge-form.tsx`).
- **Layout**: `(auth)/layout.tsx`.
- **Purpose**: Solicits 6-digit TOTP code or backup recovery code when user session has `twoFactorPending = true`.
- **Audience**: Users with 2FA enabled entering intermediate auth step.
- **State**: Partially Authenticated.
- **Status**: Implemented & Production Active.

### AUTH-SCREEN-0006: `/me/security`
- **Route**: `/me/security`
- **Component**: `SecurityPage` (`src/app/(dashboard)/me/security/page.tsx`).
- **Layout**: `(dashboard)/layout.tsx` (Global Application Shell).
- **Purpose**: Authenticated self-service 2FA enrollment, QR code scanning, secret key copy, 2FA verification, backup codes list, and password change.
- **Audience**: Authenticated Staff and Users.
- **State**: Authenticated.
- **Status**: Implemented & Production Active.

### AUTH-SCREEN-0007: `/not-authorized`
- **Route**: `/not-authorized`
- **Component**: `NotAuthorizedPage` (`src/app/not-authorized/page.tsx`).
- **Layout**: Standalone full-page view.
- **Purpose**: Standard error surface for HTTP 403 / forbidden attempts.
- **Audience**: Authenticated or Unauthenticated users lacking permissions.
- **State**: Any.
- **Status**: Implemented & Production Active.
