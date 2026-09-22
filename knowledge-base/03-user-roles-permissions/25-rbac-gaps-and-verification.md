# RBAC Gaps & Factual Verification Matrix

## Overview

This document presents a factual audit matrix of the Veloria Grand RBAC system, comparing observed code implementation against business requirements and identifying potential gaps or areas requiring manual verification.

---

## Verification Matrix

| Functional Area | Observed Code Implementation | Expected / Intended Behavior | Evidence Source | Status | Manual Verification Required |
|---|---|---|---|---|---|
| Super Admin Bypass | `hasPermission` returns `true` unconditionally for `SUPER_ADMIN` and `ADMIN` | Complete access to system resources | `src/lib/permissions.ts` | CODE VERIFIED | No |
| Dynamic Permissions | `RolePermission` DB model allows overrides for 15 roles | Admins can customize role permissions dynamically | `src/lib/rbac.ts` | CODE VERIFIED | Verify UI editor |
| Static Role Hardcoding | `SUPER_ADMIN` and `ADMIN` permissions cannot be modified in DB | Prevent lockout of system administrators | `src/lib/rbac.ts` | CODE VERIFIED | No |
| Edge Route Protection | `middleware.ts` calls `routePermission(pathname)` | Unauthorized route access redirected to `/unauthorized` | `middleware.ts` | CODE VERIFIED | Test route edge cases |
| Server Action Security | Server actions invoke `auth()` and check permissions | Protect backend actions from direct client invocation | `src/lib/actions/*` | CODE VERIFIED | Audit 100% of actions |
| Disabled Account Guard | `isActive` checked in JWT session callback | Deactivated users locked out immediately | `auth.ts` | CODE VERIFIED | Test live session revoke |
| Portal Role Boundaries | `/client/*` and `/vendor/*` routes guarded by role checks | Prevent external users from accessing internal endpoints | `middleware.ts` | CODE VERIFIED | Test URL tampering |
| Resource Scoping | Server Actions append `clientId`/`vendorId`/`employeeId` | Users restricted to their own tenant data | `src/lib/actions/*` | CODE VERIFIED | Verify edge case tables |
