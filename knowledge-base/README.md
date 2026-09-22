# VELORIA GRAND — PERMANENT APPLICATION KNOWLEDGE BASE

---

## 📌 Knowledge Base Overview

Welcome to the **Veloria Grand Permanent Application Knowledge Base**. This standalone directory located at `knowledge-base/` in the project root contains an exhaustive, code-grounded, production-grade technical and functional manual for the Veloria Grand platform.

### Purpose
- Maintain a single source of truth for developers, QA engineers, support staff, and technical managers.
- Document both **Business / User Perspectives** and **Technical / Engineering Implementations**.
- Provide machine-readable flows, database dependency mappings, fine-grained role matrices, and concrete navigation pathways.
- Ensure strict traceability between the **Autopilot Business Brief** (`Veloria-Grand-Autopilot-Brief.pdf`) and the **Actual Production Codebase**.

---

## 🏷️ Source of Truth Standards

Every technical specification in this knowledge base adheres to strict verification labels:

| Label | Meaning |
|---|---|
| `CODE VERIFIED` | Functionality verified directly by source code inspection. |
| `BRIEF DOCUMENTED` | Requirement specified in the Autopilot Business Brief document. |
| `INFERRED` | Logical design deduction based on code structures. |
| `UNKNOWN — REQUIRES CODE VERIFICATION` | Ambiguous logic or unverified edge case requiring manual review. |
| `NOT IMPLEMENTED / NOT FOUND` | Feature mentioned in the brief but completely absent from code. |
| `IMPLEMENTED — NOT EXPLICITLY DOCUMENTED IN BRIEF` | Feature present in codebase but missing from product brief. |

---

## 📂 Standalone Root Folder Structure

```
knowledge-base/                         # Standalone Knowledge Base Folder in Project Root
├── README.md                           # Master Knowledge Base Index & Navigation Guide
├── 00-discovery/                       # Phase 0 Complete Application Discovery & Registries
│   ├── 00-master-feature-registry.md   # Authoritative Master Feature Catalog
│   ├── 01-application-discovery.md     # Application Overview & Architecture Map
│   ├── 02-route-index.md               # 593 App Route Endpoints Index
│   ├── 03-role-index.md                # 23 Implemented Roles & Permission Matrix
│   ├── 04-database-index.md            # 361 Models & 166 Enums Database Architecture
│   ├── 05-integration-index.md         # 9 External Integrations & 56 Cron Automation Map
│   └── 06-dependency-map.md            # Cross-Module & Database Reverse Dependency Graph
├── 01-system-architecture/             # Chunk 01: System Architecture, Stack & Build Topology
├── 02-authentication-security/         # Chunk 02: NextAuth v5, Edge Security & Biometrics
├── 03-roles-rbac/                      # Chunk 03: Granular Role Permissions & RBAC System
├── 04-route-map/                       # Chunk 04: Detailed Navigation & Screen Index
├── 05-lead-crm/                        # Chunk 05: Lead Capture, AI Scoring & Round-Robin CRM
├── 06-quotations-pricing/              # Chunk 06: Dynamic Pricing & Quotation Engine
├── 07-contracts/                       # Chunk 07: Digital Contracts & E-Sign Subsystem
├── 08-bookings/                        # Chunk 08: Booking Calendar & Public Slot Hold Lock
├── 09-beo-operations/                  # Chunk 09: Banquet Event Order & Blueprint Engine
├── 10-kitchen-inventory/               # Chunk 10: Kitchen Prep, Recipe Aggregation & Stock
├── 11-vendors-procurement/             # Chunk 11: Vendor Directory, POs & Work Package Bids
├── 12-invoicing-payments/              # Chunk 12: Invoicing, GST Tax & Razorpay Settlement
├── 13-finance-gl/                      # Chunk 13: Double-Entry General Ledger & Payouts
├── 14-employee-central/                # Chunk 14: Employee Profiles, Organogram & Handbook
├── 15-attendance/                      # Chunk 15: Attendance Clock-in, Geofencing & Roster
├── 16-leave/                           # Chunk 16: Leave Requests, Approvals & Comp-Off
├── 17-payroll/                         # Chunk 17: Payroll Engine, Tax Slabs (PF/ESI/PT)
├── 18-recruitment/                     # Chunk 18: Recruitment ATS & Candidate Portal
├── 19-business-development/            # Chunk 19: BD Property Onboarding & Capex Projects
├── 20-marketing/                       # Chunk 20: Ad Campaigns, Social & Referral Flywheel
├── 21-whatsapp-communications/        # Chunk 21: Meta WhatsApp Cloud API & Inbound Chat
├── 22-reimbursements/                  # Chunk 22: Expense Claims, Fuel Caps & Multi-Tier Review
├── 23-portals/                         # Chunk 23: Client Portal, Vendor Portal & Guest App
└── 24-analytics-audit/                 # Chunk 24: Analytics Reports & Audit Trail System
```

---

## 📊 Documentation Execution & Status Index

| Chunk # | Module Name | Documentation Target Path | Status |
|---|---|---|---|
| **00** | Discovery & Feature Registries | `knowledge-base/00-discovery/` | `COMPLETE` |
| **01** | System Architecture & Stack | `knowledge-base/01-system-architecture/` | `COMPLETE` |
| **02** | Authentication & Security | `knowledge-base/02-authentication-security/` | `COMPLETE` |
| **03** | User Roles, Permissions & RBAC System | `knowledge-base/03-user-roles-permissions/` | `COMPLETE` |
| **04** | Route Map & Navigation | `knowledge-base/04-route-map/` | `COMPLETE` |
| **05** | Lead CRM & Acquisition | `knowledge-base/05-lead-crm/` | `COMPLETE` |
| **06** | Quotations & Pricing Engine | `knowledge-base/06-sales-quotation/` | `COMPLETE` |
| **07** | Digital Contracts & E-Sign | `knowledge-base/07-contracts/` | `COMPLETE` |
| **08** | Bookings & Event Management | `knowledge-base/08-booking-event-management/` | `COMPLETE` |
| **09** | BEO & Operations Engine | `knowledge-base/09-beo-operations/` | `COMPLETE` |
| **10** | Kitchen Prep & Inventory | `knowledge-base/10-kitchen-inventory/` | `COMPLETE` |
| **11** | Vendors & Procurement | `knowledge-base/11-vendors-procurement/` | `COMPLETE` |
| **12** | Invoicing & Payments | `knowledge-base/12-invoicing-payments/` | `COMPLETE` |
| **13** | Finance & General Ledger | `knowledge-base/13-finance-general-ledger/` | `COMPLETE` |
| **14** | Employee Central & Handbook | `knowledge-base/14-employee-central/` | `COMPLETE` |
| **15** | Attendance & Time Tracking | `knowledge-base/15-attendance/` | `COMPLETE` |
| **16** | Leave & Regularization | `knowledge-base/16-leave/` | `COMPLETE` |
| **17** | Payroll & Statutory Tax | `knowledge-base/17-payroll/` | `COMPLETE` |
| **18** | Recruitment & Candidate Portal | `knowledge-base/18-recruitment/` | `COMPLETE` |
| **19** | Business Development & Property Acquisition | `knowledge-base/19-business-development/` | `COMPLETE` |
| **20** | Marketing & Referral Flywheel | `knowledge-base/20-marketing/` | `COMPLETE` |
| **21** | WhatsApp & Communications | `knowledge-base/21-whatsapp-communications/` | `COMPLETE` |
| **22** | Client & Vendor Portals | `knowledge-base/22-portals/` | `COMPLETE` |
| **23** | Analytics & System Audit | `knowledge-base/23-analytics-audit/` | `COMPLETE` |
| **24** | Expense Claims & Reimbursements | `knowledge-base/24-reimbursements/` | `COMPLETE` |
| **25** | Final System Index | `knowledge-base/24-final-system-index/` | `COMPLETE` |

---

## 📄 Completed Chunks Summary

### Chunk 07: Digital Contracts & E-Sign System (`knowledge-base/07-contracts/`)
- **Documentation Coverage**: 31 Topic Documents (`01-contracts-overview.md` to `31-complete-contract-feature-index.md`) + 1 Module `README.md`.
- **Routes Discovered**: 8 Page Routes (`/contracts`, `/contracts/new`, `/contracts/[contractId]`, `/bd/contracts`, `/settings/contract-templates`, `/portal/contracts`, `/sign/[token]`, `/contracts/[id]`) + 2 API Routes (`/api/bd/contracts/[id]/pdf`, `/api/cron/contract-reminders`).
- **Server Actions Discovered**: 11 Server Actions (`createContract`, `updateContract`, `sendContract`, `signContract`, `cancelContract`, `createContractTemplate`, `updateContractTemplate`, `deleteContractTemplate`, `createAcqContract`, `updateAcqContract`, `convertQuoteToContract`).
- **Prisma Models Discovered**: 6 Models (`Contract`, `ContractTemplate`, `SignatureRequest`, `AcqContract`, `AcqContractVersion`, `ESignRequest`).
- **Enums Discovered**: 4 Enums (`ContractStatus`, `SignatureRequestStatus`, `ESignStatus`, `SignatureType`).
- **Roles Covered**: `SUPER_ADMIN`, `ADMIN`, `LEGAL`, `SALES_EXEC`, `SALES_HEAD`, `BD_TEAMLAD`, `CLIENT`.
- **Integrations Discovered**: PostgreSQL, Prisma ORM, AWS S3 / Cloud Storage, Resend Email Service, Meta WhatsApp Cloud API, NextAuth v5.
- **Key Implementation Highlights**: Native HTML5 Canvas signature pad (`sign-pad.tsx`), base64 signature image storage with IP/User-Agent tracking, dynamic template replacement engine (`src/lib/acq/contract-template.ts`), automatic document locking (`isLocked = true`) upon signature, quote-to-contract conversion with quotation status updates.

### Chunk 08: Booking & Event Management (`knowledge-base/08-booking-event-management/`)
- **Documentation Coverage**: 38 Topic Documents (`01-booking-module-overview.md` to `38-complete-booking-feature-index.md`) + 1 Module `README.md`.
- **Routes Discovered**: 22 Page Routes (`/bookings`, `/bookings/new`, `/bookings/calendar`, `/bookings/[bookingId]`, `/bookings/[bookingId]/control`, `/bookings/[bookingId]/day-of`, `/beo`, `/public/hold`, `/portal/bookings`, etc.) + 9 API Routes (`/api/cron/hold-expiry`, `/api/cron/event-lifecycle`, `/api/cron/event-briefings`, etc.).
- **Server Actions Discovered**: 20+ Server Actions (`createBooking`, `confirmBooking`, `cancelBooking`, `createBeo`, `createBookingInvoiceFromQuotation`, `getOperationReadinessForBooking`, `checkAvailability`, `createTasting`, `createPublicHold`, etc.).
- **Prisma Models Discovered**: 10 Core Models (`Booking`, `Beo`, `BeoIncident`, `PublicHold`, `Venue`, `Tasting`, `EventDayTimeline`, `BlackoutDate`, `SeatingChart`, `GuestList`).
- **Enums Discovered**: 5 Enums (`BookingStatus`, `BeoStatus`, `TimeSlot`, `PublicHoldStatus`, `TastingStatus`).
- **Roles Covered**: `SUPER_ADMIN`, `ADMIN`, `SALES_HEAD`, `SALES_EXEC`, `OPERATIONS_HEAD`, `EVENT_COORDINATOR`, `FINANCE`, `CLIENT`.
- **Integrations Discovered**: PostgreSQL, Prisma ORM, AWS S3 / Cloud Storage, Resend Email Service, Meta WhatsApp Cloud API, Razorpay Payment Gateway, Google Calendar API, NextAuth v5.
- **Key Implementation Highlights**: Composite database indexing `@index([venueId, date, timeSlot])` preventing slot double-booking, quotation-to-booking conversion with milestone deposit invoice generation, BEO function sheet creation with explicit headcount source tagging (`CONTRACTED`, `RSVP_CONFIRMED`, `MANUAL`), public date hold locking with automated cron expiry sweeps, day-of operational control dashboard, food tasting session manager, and client portal seating chart builder.

### Chunk 09: BEO & Operations Engine (`knowledge-base/09-beo-operations/`)
- **Documentation Coverage**: 42 Topic Documents (`01-beo-operations-overview.md` to `42-complete-beo-operations-feature-index.md`) + 1 Module `README.md`.
- **Routes Discovered**: 12 Page Routes (`/beo`, `/beo/[id]`, `/kitchen`, `/kitchen/[id]`, `/bookings/[bookingId]/operations`, `/bookings/[bookingId]/control`, `/bookings/[bookingId]/day-of`, `/bookings/[bookingId]/execution`, `/tasks`, `/vendors`, `/vendor-portal/events`, etc.) + 3 API Routes (`/api/cron/readiness-watchdog`, `/api/cron/vendor-reminders`, `/api/cron/event-briefings`).
- **Server Actions Discovered**: 15+ Server Actions (`createBeo`, `setBeoStatus`, `addBeoIncident`, `resolveBeoIncident`, `reportIncident`, `getOperationReadinessForBooking`, `createKitchenPlan`, `addExecutionTask`, `createWorkOrder`, `signWorkOrder`, etc.).
- **Prisma Models Discovered**: 13 Core Models (`Beo`, `BeoIncident`, `EmergencyIncident`, `KitchenPlan`, `KitchenPlanItem`, `EventOperation`, `EventDayTimeline`, `TimelineItem`, `ExecutionPlan`, `ExecutionTask`, `WorkOrder`, `SeatingChart`, `MenuTasting`).
- **Enums Discovered**: 7 Enums (`BeoStatus`, `TaskStatus`, `TaskPriority`, `ExecutionTaskStatus`, `VendorStatus`, `OperationStatus`, `TimelineStatus`).
- **Roles Covered**: `SUPER_ADMIN`, `ADMIN`, `OPERATIONS_HEAD`, `EVENT_COORDINATOR`, `SALES_HEAD`, `CHEF`, `VENDOR`.
- **Integrations Discovered**: PostgreSQL, Prisma ORM, AWS S3 / Cloud Storage, Resend Email Service, Meta WhatsApp Cloud API, NextAuth v5.
- **Key Implementation Highlights**: BEO function sheet lifecycle (`DRAFT` -> `PUBLISHED` -> `LOCKED`) with read-only locking enforcement, explicit headcount source tagging (`CONTRACTED`, `RSVP_CONFIRMED`, `MANUAL`) via `src/lib/guests/headcount.ts`, 7-gate operational readiness evaluation (`computeOperationReadiness`), automated readiness watchdog cron alerts (`/api/cron/readiness-watchdog` scanning 3-day horizon), event control dashboard (`/bookings/[bookingId]/control`), day-of run-of-show execution board (`/bookings/[bookingId]/day-of`), BEO incident logging with photo uploads, emergency incident protocols (`emergency.actions.ts`), SLA execution tasks with proof verification, kitchen prep batch plans with estimated vs actual food cost tracking, and vendor work order e-signatures.

### Chunk 10: Kitchen Prep & Inventory (`knowledge-base/10-kitchen-inventory/`)
- **Documentation Coverage**: 48 Topic Documents (`01-kitchen-inventory-overview.md` to `48-complete-kitchen-inventory-feature-index.md`) + 1 Module `README.md`.
- **Routes Discovered**: 11 Page Routes (`/kitchen`, `/kitchen/[id]`, `/inventory`, `/inventory/new`, `/inventory/[itemId]`, `/menu`, `/menu/new`, `/packages`, `/procurement`, `/procurement/[id]`, etc.).
- **Server Actions Discovered**: 12+ Server Actions (`createKitchenPlan`, `updateKitchenPlan`, `addPlanItem`, `updatePlanItem`, `getItems`, `createItem`, `reserveForBooking`, `releaseReservation`, `getLowStockAlerts`, `approvePR`, `markReceived`, etc.).
- **Prisma Models Discovered**: 8 Core Models (`KitchenPlan`, `KitchenPlanItem`, `InventoryItem`, `InventoryReservation`, `PurchaseRequisition`, `PurchaseRequisitionItem`, `MenuItem`, `BookingMenu`).
- **Enums Discovered**: 3 Enums (`PackageTier`, `PurchaseOrderStatus`, `VendorCategory`).
- **Roles Covered**: `SUPER_ADMIN`, `ADMIN`, `CHEF`, `OPERATIONS_HEAD`, `BUYER`, `STOREKEEPER`.
- **Integrations Discovered**: PostgreSQL, Prisma ORM, AWS S3 / Cloud Storage, Resend Email Service, General Ledger Accounting, NextAuth v5.
- **Key Implementation Highlights**: Catering bulk batch preparation (`KitchenPlan`) linked to BEO headcount sources (`CONTRACTED`, `RSVP_CONFIRMED`, `MANUAL`), exact 2-decimal food cost rollup calculations (`estFoodCost` vs `actualFoodCost`), inventory asset reservations (`InventoryReservation`) date-locking equipment for event bookings, low stock threshold warnings (`getLowStockAlerts`), purchase requisition workflows (`PurchaseRequisition`) with automatic General Ledger accrual entries upon receiving (`markReceived`), and optional Gate 4 integration in operational readiness evaluations.

### Chunk 11: Vendor & Procurement (`knowledge-base/11-vendor-procurement/`)
- **Documentation Coverage**: 47 Topic Documents (`01-vendor-procurement-overview.md` to `47-complete-vendor-procurement-feature-index.md`) + 1 Module `README.md`.
- **Routes Discovered**: 6 Dashboard Page Routes (`/vendors`, `/vendors/new`, `/vendors/[vendorId]`, `/procurement`, `/procurement/[id]`, `/payouts/bills`) + 4 Vendor Portal Routes (`/vendor-portal`, `/vendor-portal/events`, `/vendor-portal/bids`, `/vendor-portal/payouts`) + 2 Public Routes (`/vendor-activate`, `/vendor-confirm/[token]`) + 1 Cron Route (`/api/cron/vendor-reminders`).
- **Server Actions Discovered**: 15+ Server Actions (`createVendor`, `generateVendorPortalInvite`, `acceptVendorInvite`, `createWorkOrder`, `sendWorkOrder`, `signWorkOrder`, `releaseAdvance`, `createPurchaseRequisition`, `approvePR`, `markReceived`, `createVendorBill`, `approveVendorBill`, etc.).
- **Prisma Models Discovered**: 10 Core Models (`Vendor`, `BookingVendor`, `OperationVendorAssignment`, `WorkOrder`, `VendorPackage`, `VendorPackageItem`, `VendorBid`, `PurchaseRequisition`, `PurchaseRequisitionItem`, `VendorBill`).
- **Enums Discovered**: 5 Enums (`VendorStatus`, `VendorCategory`, `VendorAssignmentStatus`, `VendorBidStatus`, `VendorPackageStatus`).
- **Roles Covered**: `SUPER_ADMIN`, `ADMIN`, `OPERATIONS_HEAD`, `EVENT_COORDINATOR`, `BUYER`, `FINANCE`, `VENDOR`.
- **Integrations Discovered**: PostgreSQL, Prisma ORM, NextAuth v5, AWS S3 / Cloud Storage, Resend Email Service, Meta WhatsApp Cloud API, General Ledger Accounting.
- **Key Implementation Highlights**: Marketplace directory with case-insensitive name/email/phone deduplication, tokenized vendor portal activation (`generateVendorPortalInvite`) with takeover protection, multi-tenant vendor portal isolation (`getCurrentVendor`), Work Order lifecycle (`WO-YYYY-NNN`) with digital signature validation and advance release notifications, Purchase Requisitions (`PR-YYYY-NNN`) with strict Maker-Checker approval enforcement (`pr.requestedById !== u.id`), automated GL receipt expense accruals (`postPurchaseReceivedWithinTx`), Vendor Bills (`VB-YYMM-####`) with Maker-Checker approval enforcement (`bill.createdById !== u.id`), automated GL expense accrual posting, and advance netting against asset account 1300.

### Chunk 12: Invoicing & Payments (`knowledge-base/12-invoicing-payments/`)
- **Documentation Coverage**: 42 Topic Documents (`01-invoicing-payments-overview.md` to `42-complete-invoice-payment-feature-index.md`) + 1 Module `README.md`.
- **Routes Discovered**: 3 Dashboard Page Routes (`/invoices`, `/invoices/new`, `/payments`) + 2 Client Portal Routes (`/portal/invoices`, `/portal/invoices/[id]`) + 3 Public Checkout Routes (`/pay/[token]`, `/pay/split/[token]`, `/(print)/invoices/[id]/pdf`) + 5 REST/API Routes (`/api/payments/create-order`, `/api/payments/verify`, `/api/payments/webhook`, `/api/guest/invoice/[id]`, `/api/guest/receipt/[id]`) + 2 Cron Routes (`/api/cron/invoice-due`, `/api/cron/payment-reminders`).
- **Server Actions Discovered**: 15+ Server Actions (`createInvoice`, `updateInvoice`, `sendInvoice`, `markOverdue`, `createInstallmentPlan`, `recordPayment`, `verifyPaymentProof`, `createRazorpayOrder`, `verifyRazorpayPayment`, `generatePaymentLink`, etc.).
- **Prisma Models Discovered**: 7 Core Models (`Invoice`, `InvoiceLineItem`, `Payment`, `VenueTaxSlab`, `Installment`, `PaymentSplit`, `FinJournalEntry`).
- **Enums Discovered**: 3 Enums (`InvoiceStatus`, `PaymentStatus`, `PaymentMethod`).
- **Roles Covered**: `SUPER_ADMIN`, `ADMIN`, `FINANCE`, `SALES_HEAD`, `SALES_EXEC`, `CLIENT`.
- **Integrations Discovered**: PostgreSQL, Prisma ORM, NextAuth v5, Razorpay Payment Gateway API, AWS S3 / Cloud Storage, Resend Email Service, Meta WhatsApp Cloud API, General Ledger Accounting.
- **Key Implementation Highlights**: Sequential gapless invoice numbering (`INV-YYYY-####`), Indian GST Place of Supply rules engine (`src/lib/finance/tax.ts`), single source-of-truth money math engine (`src/lib/invoice-calc.ts`), Razorpay HMAC SHA-256 signature verification, timing-safe webhook processing (`/api/payments/webhook`), atomic single-credit capture engine (`applyRazorpayCapture`), monotonic receipt number allocation (`RCP-YYYY-NNNN`), oldest-due-first installment allocation, real-time double-entry GL receivables bridge (`receivables.ts`), public one-click checkout (`/pay/[token]`), multi-payer split links (`/pay/split/[token]`), and SSR printable HTML invoice/receipt PDF renderers.







