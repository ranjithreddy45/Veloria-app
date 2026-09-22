# CHUNK 02-10 — RESOURCE-LEVEL AUTHORIZATION

- **Status**: `CODE VERIFIED`
- **Module**: Authentication & Security
- **Target Path**: `knowledge-base/02-authentication-security/10-resource-level-authorization.md`

---

## 📌 Resource Ownership & Tenant Scoping

Role checks (`hasPermission()`) verify general action capability, but **Resource-Level Authorization** ensures a user can only access or mutate specific database records authorized for their entity scope:

```
ROLE CHECK (hasPermission("hr:read"))  !=  RESOURCE AUTHORIZATION (where: { employeeId: user.id })
```

---

## 🔍 Verified Resource Scoping Patterns

1. **Employee HR Self-Service**:
   - *Rule*: Non-HR staff can only view and edit their own attendance records, leave applications, and expense claims.
   - *Prisma Filter*: `where: { employeeId: session.user.employeeId }`.
2. **Sales Representative Lead Isolation**:
   - *Rule*: `SALES_EXEC` users view leads assigned to them or unassigned team leads.
   - *Prisma Filter*: `where: { OR: [{ assignedRepId: session.user.id }, { assignedRepId: null }] }`.
3. **Client Portal Booking Scoping**:
   - *Rule*: Clients logging into `/portal` are scoped strictly to bookings linked to their `clientId`.
   - *Prisma Filter*: `where: { clientId: session.user.clientId }`.
4. **Vendor Portal Job Scoping**:
   - *Rule*: Vendors logging into `/vendor-portal` only see work packages assigned to their `vendorId`.
   - *Prisma Filter*: `where: { vendorId: session.user.vendorId }`.
