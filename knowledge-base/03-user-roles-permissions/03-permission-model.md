# CHUNK 03-03 — PERMISSION MODEL

- **Status**: `CODE VERIFIED`
- **Module**: Roles & RBAC System
- **Target Path**: `knowledge-base/03-user-roles-permissions/03-permission-model.md`

---

## 📌 Permission Architecture & 244 Permission Keys

Permissions in Veloria Grand are represented as a strongly-typed string union `Permission` in `src/lib/permissions.ts` consisting of **244 Granular Permission Keys**.

```typescript
// src/lib/permissions.ts
export type Permission =
  | "owners:read" | "owners:create" | "owners:update" | "owners:delete"
  | "contacts:read" | "contacts:create" | "contacts:update" | "contacts:delete"
  | "leads:read" | "leads:create" | "leads:update" | "leads:delete" | "leads:assign"
  | "pipeline:read" | "pipeline:update" | "pipeline:manage"
  | "bookings:read" | "bookings:create" | "bookings:update" | "bookings:delete" | "bookings:cancel"
  | "invoices:read" | "invoices:create" | "invoices:update" | "invoices:cancel"
  | "payments:read" | "payments:create" | "payments:update" | "payments:refund" | "payments:cancel"
  | "finance:read" | "settings:read" | "users:read" | "users:manage-roles"
  | "hr:read" | "hr:write" | "recruit:read" | "vendors:read" | "projects:read"
  // ... 244 keys total
```

---

## ⚙️ Static Defaults vs Dynamic Database Overrides

1. **Static Defaults (`ROLE_PERMISSIONS`)**: Defined as a TypeScript dictionary `Record<string, Permission[]>` mapping each role to its standard granted permission keys.
2. **Wildcard Bypass (`SUPER_ADMIN` & `ADMIN`)**:
   ```typescript
   export function hasPermission(role: string, permission: Permission): boolean {
     if (role === "SUPER_ADMIN" || role === "ADMIN") return true;
     const permissions = ROLE_PERMISSIONS[role];
     return permissions?.includes(permission) ?? false;
   }
   ```
3. **Dynamic Database Overrides (`src/lib/rbac.ts`)**: For 15 editable roles (`EDITABLE_ROLES`), `getEffectivePermissions(userId, role)` queries custom user/role permission overrides stored in the database, allowing admins to grant or revoke specific permissions dynamically.
