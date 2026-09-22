# Role Deep Dive: ADMIN

## Overview

`ADMIN` is the standard administrative role in Veloria Grand, granting full operational and management capabilities across all business modules.

---

## Role Profile

- **Exact Code Value**: `"ADMIN"`
- **Display Name**: Administrator
- **User Type**: Internal Business Admin
- **Database Source**: `UserRole` Enum (`ADMIN`)
- **Portal Access**: None (Internal Dashboard Only)
- **Active Status**: Active

---

## Key Capabilities & Scoping

### 1. Permission Model
- **Full Operational Access**: Similar to `SUPER_ADMIN`, `ADMIN` bypasses permission checks in `src/lib/permissions.ts` (`hasPermission` returns `true`).
- **Route Access**: Full access to all functional business routes (`/sales`, `/events`, `/finance`, `/hr`, `/settings`).

### 2. Operational Authority
- **Module Management**: Full CRUD capabilities across Leads, Quotations, Bookings, Events, Invoices, Employees, Inventory, and Properties.
- **Approval Authority**: Can approve or reject any operational, HR, or financial request.
- **User Management**: Can create and manage operational staff accounts.

---

## Code References

- `src/lib/permissions.ts`
- `middleware.ts`
