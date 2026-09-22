# CHUNK 03-05 — ROUTE AUTHORIZATION

- **Status**: `CODE VERIFIED`
- **Module**: Roles & RBAC System
- **Target Path**: `knowledge-base/03-user-roles-permissions/05-route-authorization.md`

---

## 🗺️ Edge Route Permission Resolution (`middleware.ts`)

Edge route protection maps request path prefixes to required permissions via `routePermission(pathname)` in `src/lib/permissions.ts`:

```typescript
export const ROUTE_PERMISSIONS: { prefix: string; permission: Permission }[] = [
  { prefix: "/settings/users", permission: "users:read" },
  { prefix: "/settings/roles", permission: "users:manage-roles" },
  { prefix: "/people", permission: "hr:read" },
  { prefix: "/recruitment", permission: "recruit:read" },
  { prefix: "/owners", permission: "owners:read" },
  { prefix: "/leads", permission: "leads:read" },
  { prefix: "/pipeline", permission: "pipeline:read" },
  { prefix: "/contacts", permission: "contacts:read" },
  { prefix: "/quotes", permission: "quotes:read" },
  { prefix: "/contracts", permission: "contracts:read" },
  { prefix: "/bookings", permission: "bookings:read" },
  { prefix: "/invoices", permission: "invoices:read" },
  { prefix: "/payments", permission: "payments:read" },
  { prefix: "/finance", permission: "finance:read" },
  { prefix: "/beo", permission: "beo:read" },
  { prefix: "/kitchen", permission: "kitchen:read" },
  { prefix: "/vendors", permission: "vendors:read" },
  { prefix: "/procurement", permission: "vendors:read" },
  { prefix: "/projects", permission: "projects:read" },
  { prefix: "/marketing", permission: "analytics:read" },
];
```
