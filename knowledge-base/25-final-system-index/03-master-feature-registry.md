# Phase 3: Master Feature Registry

| Feature ID | Module | Feature | Route | Action/API | Model | Status | Verification |
|---|---|---|---|---|---|---|---|
| FEAT-ARCH-01 | Architecture | Dynamic NextAuth JWT Session | App Middleware | `/api/auth/[...nextauth]` | `User` | IMPLEMENTED | Verified in 01 & 02 |
| FEAT-SEC-01 | Security | Role-Based Access Control (RBAC) | All Dashboard Routes | `requirePermission()` | `Role`, `User` | IMPLEMENTED | Verified in 02 & 03 |
| FEAT-CRM-01 | Lead CRM | Auto Lead Assignment & SLA Tracker | `/leads` | `createLeadAction` | `Lead`, `LeadActivity` | IMPLEMENTED | Verified in 05 |
| FEAT-SALE-01 | Sales | Quotation Pricing Engine & Tax Calculation | `/sales/quotations` | `createQuotationAction` | `Quotation`, `QuoteItem` | IMPLEMENTED | Verified in 06 |
| FEAT-SALE-02 | Sales | Public Quote Acceptance & Soft Hold | `/q/[token]` | `acceptQuoteAction` | `PublicHoldToken` | IMPLEMENTED | Verified in 06 |
| FEAT-CONT-01 | Contracts | Digital Signature & Contract Legal Audit | `/sign/[token]` | `signContractAction` | `Contract`, `Signature` | IMPLEMENTED | Verified in 07 |
| FEAT-BOOK-01 | Booking | Venue Availability & Booking Lifecycle | `/bookings` | `createBookingAction` | `Booking`, `Venue` | IMPLEMENTED | Verified in 08 |
| FEAT-BEO-01 | Operations | BEO Read-Only Lock & Readiness Gate | `/beo/[id]` | `lockBeoAction` | `BEO`, `BEOItem` | IMPLEMENTED | Verified in 09 |
| FEAT-KITCH-01 | Kitchen | Recipe Costing & Stock Deduction | `/kitchen/inventory` | `deductInventoryAction` | `Recipe`, `InventoryItem` | IMPLEMENTED | Verified in 10 |
| FEAT-PROC-01 | Procurement | Vendor Purchase Requisitions & AP Bills | `/procurement/orders` | `createPurchaseOrderAction` | `PurchaseOrder`, `VendorBill` | IMPLEMENTED | Verified in 11 |
| FEAT-INV-01 | Invoicing | GST Invoice Generation & Payment Gateways | `/invoices` | `createInvoiceAction` | `Invoice`, `Payment` | IMPLEMENTED | Verified in 12 |
| FEAT-FIN-01 | Finance | Double-Entry Balancing & Immutable GL | `/finance/journals` | `postJournalEntryAction` | `FinJournalEntry`, `FinAccount` | IMPLEMENTED | Verified in 13 |
| FEAT-HR-01 | HR Central | Employee Master & Org Structure | `/hr/employees` | `createEmployeeAction` | `Employee`, `Department` | IMPLEMENTED | Verified in 14 |
| FEAT-ATT-01 | Attendance | Biometric Hardware Log Sync & Manual Logs | `/hr/attendance` | `syncAttendanceAction` | `AttendanceRecord` | IMPLEMENTED | Verified in 15 |
| FEAT-LEAV-01 | Leave | Leave Balance Deduction & LOP Computation | `/hr/leave` | `approveLeaveAction` | `LeaveRequest`, `LeaveBalance` | IMPLEMENTED | Verified in 16 |
| FEAT-PAY-01 | Payroll | Fixed 30-Day Denominator Payroll Engine | `/hr/payroll` | `processPayrollAction` | `HrPayslip`, `HrPayrollRun` | IMPLEMENTED | Verified in 17 |
| FEAT-REC-01 | Recruitment | Applicant Pipeline & Offer Generation | `/hr/recruitment` | `createApplicantAction` | `JobOpening`, `Applicant` | IMPLEMENTED | Verified in 18 |
| FEAT-BD-01 | Business Dev | Property Acquisition & Lease Pipeline | `/bd/properties` | `createAcquisitionDealAction` | `PropertyLead`, `AcquisitionDeal` | IMPLEMENTED | Verified in 19 |
| FEAT-MKT-01 | Marketing | Campaign ROI & Multi-Channel Attribution | `/marketing/campaigns` | `trackAttributionAction` | `Campaign`, `AttributionLog` | IMPLEMENTED | Verified in 20 |
| FEAT-COMM-01 | Communications | Meta WhatsApp Cloud API & Template Engine | `/communications/whatsapp` | `sendWhatsAppMessageAction` | `WhatsAppLog`, `WhatsAppTemplate` | IMPLEMENTED | Verified in 21 |
| FEAT-PORT-01 | Portals | Client Portal & Vendor Bidding Workspace | `/portal/*`, `/vendor-portal/*` | `submitVendorBidAction` | `Client`, `Vendor` | IMPLEMENTED | Verified in 22 |
| FEAT-ANAL-01 | Analytics | Executive Dashboard & Immutable Audit Log | `/analytics` | `getAnalyticsAction` | `ActivityLog` | IMPLEMENTED | Verified in 23 |
| FEAT-REIMB-01 | Reimbursements | Expense Claims & Proof Upload | `/hr/reimbursements` | `submitClaimAction` | `ExpenseClaim` | IMPLEMENTED | Verified in 24 |
