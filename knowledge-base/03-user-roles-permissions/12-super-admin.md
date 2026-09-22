# Role Deep Dive: SUPER_ADMIN

## Overview

`SUPER_ADMIN` is the root administrative role in Veloria Grand. Users with this role possess full, unrestricted system access across all modules, settings, database tables, user management, and tenant configurations.

---

## Role Profile

- **Exact Code Value**: `"SUPER_ADMIN"`
- **Display Name**: Super Administrator
- **User Type**: Internal System Admin
- **Database Source**: `UserRole` Enum (`SUPER_ADMIN`)
- **Portal Access**: None (Internal Dashboard Only)
- **Active Status**: Active

---

## Key Capabilities & Scoping

### 1. Permission Model
- **Wildcard Bypass**: In `src/lib/permissions.ts`, `hasPermission("SUPER_ADMIN", ...)` returns `true` for **ALL** permissions without checking any permission map.
- **Route Access**: Full access to all `/dashboard`, `/admin`, `/settings`, `/users`, `/api/...` endpoints.

### 2. Administrative Functions
- **User & Role Lifecycle**: Create, edit, suspend, delete, and reassign roles for any user (including other admins).
- **System Settings**: Modify organization settings, payment gateway keys, SMTP credentials, and integrations.
- **Audit Logs**: Full access to system security logs (`ActivityLog`, `ApprovalLog`, system audit trails).
- **Approval Override**: Override any pending or rejected approval state across finance, HR, sales, or operations.

---

## Code References

- `src/lib/permissions.ts` (`hasPermission` check)
- `middleware.ts` (`SUPER_ADMIN` route bypass)
- `src/lib/rbac.ts` (Dynamic permission management)
