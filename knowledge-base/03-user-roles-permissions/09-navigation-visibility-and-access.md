# Navigation Visibility & Access Control

## Overview

Veloria Grand uses dynamic sidebar and header navigation filtering based on user roles and permissions. 

> [!IMPORTANT]
> **Security Warning**: UI navigation filtering is solely for user experience. Hidden menu items do **NOT** secure backend endpoints. All routes, Server Actions, and API endpoints enforce independent backend authorization checks.

---

## Navigation Filtering Logic

1. **Role Filtering**: Sidebar items define an `allowedRoles` array or `requiredPermission` string.
2. **Evaluation**: Navigation component filters items using `hasPermission(session.user.role, item.permission)` or checking `item.allowedRoles.includes(session.user.role)`.
3. **Super Admin Bypass**: Roles `SUPER_ADMIN` and `ADMIN` render all internal navigation items unconditionally.

---

## Navigation Groups & Access Rules

| Navigation Group | Route Path | Visibility Rule | Allowed Roles | Backend Enforcement |
|---|---|---|---|---|
| Dashboard | `/dashboard` | Authenticated Staff | All Internal Roles | Session Check |
| Sales & Pipeline | `/sales`, `/leads` | `sales:read` | `SUPER_ADMIN`, `ADMIN`, `SALES_EXEC`, `SALES_HEAD`, `BD_EXECUTIVE`, `BD_HEAD` | Route & Action Check |
| Events & BEO | `/events`, `/beo` | `events:read` | `SUPER_ADMIN`, `ADMIN`, `EVENT_COORDINATOR`, `OPERATIONS`, `OPERATIONS_HEAD` | Route & Action Check |
| Finance & Billing | `/finance`, `/invoices` | `finance:read` | `SUPER_ADMIN`, `ADMIN`, `FINANCE`, `AUDITOR` | Route & Action Check |
| HR & Payroll | `/hr`, `/employees` | `hr:read` | `SUPER_ADMIN`, `ADMIN`, `HR_MANAGER`, `HR_EXECUTIVE` | Route & Action Check |
| Property & BD | `/property`, `/bd` | `property:read` | `SUPER_ADMIN`, `ADMIN`, `PROPERTY_MANAGER`, `BD_EXECUTIVE`, `BD_HEAD` | Route & Action Check |
| Vendor Portal | `/vendor/dashboard` | `VENDOR` Role | `VENDOR` | Portal Route Check |
| Client Portal | `/client/dashboard` | `CLIENT` Role | `CLIENT` | Portal Route Check |
| System Settings | `/settings`, `/users` | `settings:manage` | `SUPER_ADMIN`, `ADMIN` | Strictly Enforced |

---

## Potential UI vs Backend Mismatches

- If a user manually types a URL (e.g. `/finance/payroll`) while missing the sidebar link, the backend middleware or page component checks `hasPermission` and redirects to `/unauthorized` or `/dashboard`.
- If backend permission is revoked dynamically, the UI sidebar updates upon session refresh or token revalidation.
