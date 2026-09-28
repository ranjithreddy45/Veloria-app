# PHASE 03 — AUTHENTICATION UI FORENSICS: SYSTEM OVERVIEW

## 1. Executive Summary

This document provides the foundational UI forensic analysis for the **Authentication & Access System** of **Veloria Grand** (Next.js 16.1.6, React 19.2.3, NextAuth 5, Tailwind CSS 4, Radix UI).

The authentication UI layer governs how users (Staff/Employees, Clients, Vendors) establish identity, submit credentials, handle multi-factor verification (2FA/TOTP), recover credentials, maintain JWT session states, and transition into their role-specific application shells (`/dashboard`, `/portal`, `/vendor-portal`).

```
USER ──► AUTH SCREEN ──► INPUT VALIDATION ──► AUTH ACTION ──► NEXTAUTH JWT ──► SESSION ──► ROLE REDIRECT ──► APPLICATION SHELL
```

---

## 2. Core Authentication Architecture & Boundaries

| Component Layer | Primary Technology | Source File Location | Purpose & Function |
|---|---|---|---|
| **Auth Layout Shell** | React Server Component | [layout.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(auth)/layout.tsx) | Centered glassmorphic container with Veloria Grand branding & dark backdrop |
| **Sign-In View** | React Client Component | [sign-in-form.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(auth)/sign-in/_components/sign-in-form.tsx) | Credential input, password toggle, error toasts, submit handler |
| **Two-Factor Challenge** | React Client Component | [two-factor-challenge-form.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(auth)/two-factor/_components/two-factor-challenge-form.tsx) | 6-digit TOTP / recovery code entry when `twoFactorPending` is true |
| **Self-Service 2FA Setup** | React Client Component | [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/me/security/page.tsx) | QR code rendering, secret key copying, TOTP verification, backup code list |
| **Self-Service Sign-Up** | React Client Component | [sign-up-form.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(auth)/sign-up/_components/sign-up-form.tsx) | Self-registration for clients with initial unverified status |
| **Forgot / Reset Password** | React Client Components | [forgot-password-form.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(auth)/forgot-password/_components/forgot-password-form.tsx) | Requesting password reset link & setting new password with token |
| **Not Authorized View** | React Server Component | [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/not-authorized/page.tsx) | ShieldAlert error screen when access to a resource/route is forbidden |
| **Session Revalidator** | React Client Component | [session-revalidator.tsx](file:///Users/fci/Documents/Veloria-app/src/components/auth/session-revalidator.tsx) | Triggers `update()` from `next-auth/react` on shell mount |
| **2FA Soft Policy Gate** | React Server Component | [two-factor-gate.tsx](file:///Users/fci/Documents/Veloria-app/src/components/security/two-factor-gate.tsx) | Enforces role-based 2FA requirement banner or redirect |

---

## 3. Supported User Audiences & Access Vectors

1. **Staff & Employees (`ADMIN`, `SALES`, `OPS`, `FINANCE`, `HR`, `GENERAL_MANAGER`)**
   - Authenticate via `/sign-in` with email & password.
   - Subject to role-based 2FA enforcement (`ADMIN`, `FINANCE`, `GENERAL_MANAGER`).
   - Redirected to `/dashboard` upon session issuance.
2. **Clients (`CLIENT`)**
   - Authenticate via `/sign-in` or self-register via `/sign-up`.
   - Access client self-service portal at `/portal`.
   - Invited via staff portal invite tokens (`generatePortalInvite`).
3. **Vendors (`VENDOR`)**
   - Authenticate via `/sign-in` or access vendor portal at `/vendor-portal`.
   - Access vendor portal features for procurement and bid submissions.
4. **Public Link Token Users (Unauthenticated Guests)**
   - Access specific resources via tokenized URLs: `/q/[token]` (Quotations), `/sign/[token]` (Contracts), `/pay/[token]` (Payments), `/hold/[token]` (Date Holds).
   - Require NO username/password session.

---

## 4. Key Security & UI Design Principles

- **Zero-Trust Input Validation**: Client-side validation using `zod` schemas (`signInSchema`, `signUpSchema`, `forgotPasswordSchema`, `resetPasswordSchema`) before server action submission.
- **Server Action Security**: Server actions (`signInWithCredentials`, `signUpAction`, `forgotPasswordAction`, `resetPasswordAction`, `completeTwoFactorChallenge`) sanitize and validate inputs on the server.
- **JWT Session Persistence**: HTTP-only session cookies (`__Secure-authjs.session-token` or `authjs.session-token`) managed by NextAuth.
- **Visual Feedback & Micro-Interactions**: Loading states (`Loader2` spin), password visibility toggles (`Eye` / `EyeOff`), and toast notifications (`sonner`) for failure/success messages.
