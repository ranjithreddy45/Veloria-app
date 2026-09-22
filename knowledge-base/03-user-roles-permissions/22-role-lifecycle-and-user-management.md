# Role Lifecycle & User Management

## Overview

This document describes how user accounts are created, assigned roles, updated, suspended, and audited in Veloria Grand.

---

## Lifecycle Stages

### 1. User Creation
- **Initiator**: `SUPER_ADMIN` or `ADMIN`.
- **Action**: In `src/lib/actions/user.ts` (`createUser`), password is hashed using bcrypt (`saltRounds = 10`), role is assigned from `UserRole` enum.
- **Verification**: Email uniqueness check against `User` model.

### 2. Role Change
- **Initiator**: `SUPER_ADMIN` or `ADMIN`.
- **Effect on Active Sessions**: NextAuth session updates upon token refresh or re-login.
- **Audit Trail**: Action is logged in `ActivityLog` model with `userId`, `previousRole`, `newRole`, `changedById`.

### 3. Account Disabling / Suspension
- **Mechanism**: Setting `user.isActive = false` in database.
- **Middleware & Auth Enforcement**: `auth.ts` checks `user.isActive` during JWT token verification and session callback. Disabled accounts are immediately invalidated and redirected to `/login?error=AccountDisabled`.

---

## Code References

- `src/lib/actions/user.ts`
- `auth.ts` (JWT & Session callback `isActive` check)
- `src/lib/rbac.ts`
