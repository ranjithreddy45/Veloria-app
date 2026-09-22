# RBAC Security Boundaries

## Overview

Veloria Grand implements a multi-layered defense-in-depth security model to enforce authorization across every entry point.

---

## Security Layers

1. **Layer 1: Authentication Boundary**: `auth.ts` verifies user identity, active status, and session validity.
2. **Layer 2: Edge Route Boundary**: `middleware.ts` enforces route-level access using `routePermission()`.
3. **Layer 3: UI Navigation Boundary**: Dynamic sidebar filters menu items based on role permissions (UX layer only).
4. **Layer 4: Server Action Authorization**: Every Server Action validates `session` and executes `hasPermission()` or inline role checks.
5. **Layer 5: API Route Authorization**: Next.js API routes verify session credentials or secret header tokens (`CRON_SECRET`, webhook signatures).
6. **Layer 6: Resource Scoping Boundary**: Database queries append `userId`, `employeeId`, `clientId`, or `vendorId` constraints.
7. **Layer 7: Approval Workflow Boundary**: State transitions enforce explicit approver role rules (`APPROVAL_LOG`).
8. **Layer 8: Audit Logging Boundary**: Critical administrative and permission actions record audit entries in `ActivityLog`.

---

## Verification Status

All 8 security boundaries have been verified directly in the codebase (`CODE VERIFIED`).
