# Client Portal Routes (17 Endpoints)

## Overview

Client Portal routes (base path `(portal)` / `/client/*`) provide self-service event planning, quotation approval, invoice tracking, payment execution, and venue communication for booked clients holding the `CLIENT` role.

---

## Client Portal Endpoint Registry

| Route Path | Filesystem Location | Primary Purpose | Scoping Mechanism | Allowed Actions |
|---|---|---|---|---|
| `/client/dashboard` | `src/app/(portal)/client/dashboard/page.tsx` | Overview of active event bookings & balance | `session.user.clientId` | View Summary, Quick Pay |
| `/client/bookings` | `src/app/(portal)/client/bookings/page.tsx` | List of past and upcoming venue bookings | `clientId == session.clientId` | View Details, Request Changes |
| `/client/bookings/[id]` | `src/app/(portal)/client/bookings/[id]/page.tsx` | Detailed event itinerary & venue layout | `booking.clientId == session.clientId` | Approve BEO layout, Chat |
| `/client/quotations` | `src/app/(portal)/client/quotations/page.tsx` | Quotations received from sales executive | `quotation.clientId == session.clientId` | Accept / Reject Quotation |
| `/client/contracts` | `src/app/(portal)/client/contracts/page.tsx` | Event agreements and digital signature status | `contract.clientId == session.clientId` | E-Sign Contract |
| `/client/invoices` | `src/app/(portal)/client/invoices/page.tsx` | Billing statements, deposit receipts & dues | `invoice.clientId == session.clientId` | Download PDF, Make Payment |
| `/client/messages` | `src/app/(portal)/client/messages/page.tsx` | Direct chat with assigned Event Coordinator | `conversation.clientId == session.clientId` | Send Message, Upload Files |
