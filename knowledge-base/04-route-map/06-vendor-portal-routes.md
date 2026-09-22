# Vendor Portal Routes (4 Endpoints)

## Overview

Vendor Portal routes (base path `(vendor-portal)` / `/vendor/*`) allow suppliers, caterers, decorators, and contractors to manage purchase orders, submit work bids, and track payments under role `VENDOR`.

---

## Vendor Portal Endpoint Registry

| Route Path | Filesystem Location | Primary Purpose | Scoping Constraint | Key Actions |
|---|---|---|---|---|
| `/vendor/dashboard` | `src/app/(vendor-portal)/vendor/dashboard/page.tsx` | Vendor metrics, active POs & bidding opportunities | `session.user.vendorId` | View Overview |
| `/vendor/orders` | `src/app/(vendor-portal)/vendor/orders/page.tsx` | Assigned Purchase Orders & delivery schedules | `vendorId == session.vendorId` | Accept PO, Update Status |
| `/vendor/bids` | `src/app/(vendor-portal)/vendor/bids/page.tsx` | Open procurement work packages & RFQs | `vendorId == session.vendorId` | Submit Quote / Bid |
| `/vendor/invoices` | `src/app/(vendor-portal)/vendor/invoices/page.tsx` | Vendor billing submissions & payment status | `vendorId == session.vendorId` | Upload Invoice |
