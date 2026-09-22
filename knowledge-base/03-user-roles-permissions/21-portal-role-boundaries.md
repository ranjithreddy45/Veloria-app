# Portal Role Boundaries & Isolation

## Overview

Veloria Grand enforces strict isolation between internal staff users and external portal users (`CLIENT` and `VENDOR`).

---

## Authentication & Route Isolation

- **Client Portal Routes**: Base path `/client/*`. Accessible exclusively by users with role `CLIENT`.
- **Vendor Portal Routes**: Base path `/vendor/*`. Accessible exclusively by users with role `VENDOR`.
- **Internal Routes**: Base path `/dashboard/*`, `/admin/*`, etc. Blocked for `CLIENT` and `VENDOR` roles at `middleware.ts`.

---

## Data & Resource Scoping Rules

| Portal Type | Role | Required Session Key | Database Query Constraint | Internal Data Hidden |
|---|---|---|---|---|
| Client Portal | `CLIENT` | `session.user.clientId` | `WHERE clientId = session.user.clientId` | Cost margins, vendor contracts, internal notes |
| Vendor Portal | `VENDOR` | `session.user.vendorId` | `WHERE vendorId = session.user.vendorId` | Client pricing, overall event budgets, sales leads |

---

## Code References

- `middleware.ts` (Portal path guard)
- `src/lib/actions/client-portal.ts`
- `src/lib/actions/vendor-portal.ts`
