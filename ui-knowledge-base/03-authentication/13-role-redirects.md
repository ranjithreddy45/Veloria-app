# ROLE-BASED AUTHENTICATION REDIRECTS

## 1. Post-Authentication Destination Mapping

Upon successful login or 2FA verification, the application evaluates the user's assigned RBAC role and executes a direct redirect to the corresponding workspace shell.

```
USER AUTHENTICATED
  │
  ├── role === "CLIENT" ────────► /portal
  ├── role === "VENDOR" ────────► /vendor-portal
  └── staff roles ─────────────► /dashboard
      (ADMIN, SALES, OPS, FINANCE, HR, GENERAL_MANAGER)
```

---

## 2. Destination Matrix

| Role | Target Workspace Route | Target Layout Shell | Purpose |
|---|---|---|---|
| `ADMIN` | `/dashboard` | Executive Dashboard | Full system administration |
| `GENERAL_MANAGER` | `/dashboard` | Executive Dashboard | Hotel & venue management |
| `SALES` | `/dashboard` | Executive Dashboard | Lead CRM & Quotations |
| `OPS` | `/dashboard` | Executive Dashboard | Event Operations & BEO |
| `FINANCE` | `/dashboard` | Executive Dashboard | Invoicing & Ledger |
| `HR` | `/dashboard` | Executive Dashboard | Employee Central & Payroll |
| `CLIENT` | `/portal` | Client Portal | Event portal & invoice payments |
| `VENDOR` | `/vendor-portal` | Vendor Portal | Procurement & purchase orders |
