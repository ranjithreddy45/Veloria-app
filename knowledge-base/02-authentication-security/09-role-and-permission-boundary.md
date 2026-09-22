# CHUNK 02-09 — ROLE AND PERMISSION BOUNDARY

- **Status**: `CODE VERIFIED`
- **Module**: Authentication & Security
- **Target Path**: `knowledge-base/02-authentication-security/09-role-and-permission-boundary.md`

---

## 📌 Architectural Security Boundary

The RBAC boundary translates user authentication identity into granular permission keys:

```
[User Session (auth())]  --> UserRole ("SALES_EXEC")
                                  │
                                  ▼
[ROLE_PERMISSIONS Matrix in src/lib/permissions.ts]
                                  │
                                  ▼
[Granted Permission Keys: "leads:read", "quotes:create", "bookings:read"]
                                  │
                                  ▼
[Server Action Assert: hasPermission("quotes:create")]
```

> [!NOTE]
> Comprehensive role-by-role permission definitions belong to **Chunk 03 — Roles & RBAC System**. Reference `knowledge-base/00-discovery/03-role-index.md` for complete matrices.
