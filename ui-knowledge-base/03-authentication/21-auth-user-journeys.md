# AUTHENTICATION USER JOURNEYS

## 1. Journey 1: Standard Staff Login
1. Staff member navigates to `/sign-in`.
2. Staff enters valid email (`admin@veloriagrand.com`) and password.
3. Form submits via `signInWithCredentials`.
4. NextAuth validates password with bcryptjs and issues JWT cookie.
5. System evaluates user role (`ADMIN`) and redirects to `/dashboard`.
6. Dashboard shell mounts with executive navigation options.

---

## 2. Journey 2: Staff Login with 2FA
1. Staff member with 2FA enabled enters email and password on `/sign-in`.
2. Server action sets `twoFactorPending = true`.
3. Client redirects immediately to `/two-factor`.
4. User enters 6-digit TOTP code from authenticator app.
5. `completeTwoFactorChallenge` verifies TOTP secret.
6. Session updates to `twoFactorPending = false`, system redirects to `/dashboard`.

---

## 3. Journey 3: Client Self-Registration
1. Client navigates to `/sign-up`.
2. Client enters name, email, password, confirm password.
3. Form validates via `signUpSchema`.
4. User created with `CLIENT` role.
5. Client redirected to `/portal` or `/sign-in`.
