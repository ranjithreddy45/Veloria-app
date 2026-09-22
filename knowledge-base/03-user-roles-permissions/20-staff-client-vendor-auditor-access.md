# Role Deep Dive: Staff, Client, Vendor & Auditor

## Overview

Defines general internal staff, external portal users, and read-only auditors.

---

## Role Profiles

### 1. STAFF
- **Exact Code Value**: `"STAFF"`
- **Function**: General staff members. Basic employee self-service access (view own profile, submit leave request, log attendance).

### 2. CLIENT
- **Exact Code Value**: `"CLIENT"`
- **Function**: External clients accessing the Client Portal (`/client/dashboard`). View own event details, quotations, invoices, and make payments.

### 3. VENDOR
- **Exact Code Value**: `"VENDOR"`
- **Function**: External suppliers accessing the Vendor Portal (`/vendor/dashboard`). View purchase orders, submit quotations/bids, upload invoices.

### 4. AUDITOR
- **Exact Code Value**: `"AUDITOR"`
- **Function**: Internal or external auditor. Read-only access across financial reports, logs, and transaction records (`finance:read`, `reports:read`).

---

## Code References

- `src/lib/actions/client-portal.ts`
- `src/lib/actions/vendor-portal.ts`
- `middleware.ts`
