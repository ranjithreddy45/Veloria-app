# CHUNK 02-20 — AUTHENTICATION END-TO-END FLOWS

- **Status**: `CODE VERIFIED`
- **Module**: Authentication & Security
- **Target Path**: `knowledge-base/02-authentication-security/20-authentication-end-to-end-flows.md`

---

## 🔄 Flow 01: Internal Staff Credentials Login

```mermaid
flowchart TD
    User["Staff User"] --> Form["/sign-in Page"]
    Form --> Credentials["auth.ts Credentials Provider"]
    Credentials --> DBUser["prisma.user.findUnique(email)"]
    DBUser --> HashCheck["bcryptjs.compare(password, passwordHash)"]
    HashCheck -->|Valid| TFCheck{"twoFactorEnabled?"}
    TFCheck -->|No| JWTGen["Generate NextAuth JWT Session Token"]
    TFCheck -->|Yes| TFRedirect["Redirect to /two-factor Challenge"]
    JWTGen --> Middleware["middleware.ts Validates Session"]
    Middleware --> Dash["Render /dashboard Layout"]
```

---

## 🔄 Flow 02: Protected Server Action & Resource Scope Check

```mermaid
flowchart TD
    ClientUI["Client Form Component"] --> ActionCall["createReimbursementClaim(formData)"]
    ActionCall --> SessionFetch["requireUser() -> auth()"]
    SessionFetch --> PermCheck["hasPermission(role, 'hr:read')"]
    PermCheck -->|Passed| ZodParse["reimbursementClaimSchema.parse(payload)"]
    ZodParse --> ResourceScope["Prisma query scoped to employeeId: session.user.id"]
    ResourceScope --> DBWrite["prisma.hrReimbursementClaim.create()"]
    DBWrite --> Result["Return { success: true }"]
```
