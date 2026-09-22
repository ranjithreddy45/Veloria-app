# CHUNK 02-14 — PORTAL AUTHENTICATION

- **Status**: `CODE VERIFIED`
- **Module**: Authentication & Security
- **Target Path**: `knowledge-base/02-authentication-security/14-portal-authentication.md`

---

## 🌐 Portal-Specific Access Control Boundaries

| Portal Surface | Allowed Roles | Auth Mechanism | Route Protection |
|---|---|---|---|
| **Client Portal** (`src/app/(portal)/*`) | `CLIENT`, `ADMIN`, `SUPER_ADMIN` | NextAuth Session / Booking Token | `middleware.ts` asserts `PORTAL_ROLES` |
| **Vendor Portal** (`src/app/(vendor-portal)/*`)| `VENDOR`, `ADMIN`, `SUPER_ADMIN` | NextAuth Session / Vendor Invite | `middleware.ts` asserts `VENDOR_PORTAL_ROLES` |
| **Guest App** (`src/app/(guest)/*`) | Public / Event Guest Code | Guest Session Token (`src/lib/guest-session.ts`)| Tokenized URL parameter check |
