# API Authorization Model

## Overview

API authorization in Veloria Grand secures backend endpoints (`src/app/api/...`) using session authentication via NextAuth (`auth()`), header-based API secret verification, webhook signature validation, and resource-level scoping.

---

## Authorization Categories

### 1. Authenticated Internal APIs
- **Mechanism**: Invokes `auth()` from `auth.ts` to retrieve `session`.
- **Validation**: Checks `session?.user` and verifies role/permission via `hasPermission(session.user.role, requiredPermission)` or inline role check `session.user.role === "SUPER_ADMIN"`.
- **Failure Response**: Returns `NextResponse.json({ error: "Unauthorized" }, { status: 401 })` or `{ error: "Forbidden" }, { status: 403 }`.
- **Code References**:
  - `src/app/api/users/route.ts`
  - `src/app/api/reports/route.ts`
  - `src/app/api/documents/route.ts`

### 2. Public APIs
- **Mechanism**: Unauthenticated endpoints open to public traffic or guests.
- **Scope**: Includes public catalog items, contact forms, and health checks.
- **Failure Response**: N/A (accessible without credentials).
- **Code References**:
  - `src/app/api/health/route.ts`
  - `src/app/api/public/events/route.ts`

### 3. Cron & System Service APIs
- **Mechanism**: Protected via bearer token or custom header matching `process.env.CRON_SECRET`.
- **Validation**: Checks `req.headers.get("authorization") === "Bearer " + process.env.CRON_SECRET`.
- **Failure Response**: `401 Unauthorized` if secret is missing or mismatched.
- **Code References**:
  - `src/app/api/cron/notifications/route.ts`
  - `src/app/api/cron/billing/route.ts`

### 4. Webhook APIs
- **Mechanism**: External payment gateway and service integration webhooks (e.g., Razorpay, WhatsApp Business API).
- **Validation**: Verifies HMAC signatures using secret keys (`RAZORPAY_WEBHOOK_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`).
- **Failure Response**: `400 Bad Request` or `401 Unauthorized` on signature failure.
- **Code References**:
  - `src/app/api/webhooks/razorpay/route.ts`
  - `src/app/api/webhooks/whatsapp/route.ts`

### 5. Portal APIs
- **Mechanism**: Session-based auth enforcing specific portal role checks (`CLIENT` or `VENDOR`).
- **Validation**: Confirms `session.user.role === "CLIENT"` and scopes database query by `session.user.clientId`.
- **Failure Response**: `403 Forbidden` if internal user or wrong portal role accesses endpoint.
- **Code References**:
  - `src/app/api/portal/client/bookings/route.ts`
  - `src/app/api/portal/vendor/purchase-orders/route.ts`

---

## Security Distinction Matrix

| Endpoint Category | Authentication | Authorization Check | Secret / Key Requirement | Resource Scoping | Status |
|---|---|---|---|---|---|
| Internal Admin API | NextAuth Session | `SUPER_ADMIN` / `ADMIN` Role | N/A | Global | CODE VERIFIED |
| HR / Staff API | NextAuth Session | `hasPermission` / `HR_MANAGER` | N/A | Department / User ID | CODE VERIFIED |
| Vendor Portal API | NextAuth Session | `VENDOR` Role | N/A | `vendorId == session.user.vendorId` | CODE VERIFIED |
| Client Portal API | NextAuth Session | `CLIENT` Role | N/A | `clientId == session.user.clientId` | CODE VERIFIED |
| Cron Job API | Header Token | Secret Match | `CRON_SECRET` | System-wide | CODE VERIFIED |
| Gateway Webhook | Signature | HMAC Hash Verification | `WEBHOOK_SECRET` | Gateway Event ID | CODE VERIFIED |
