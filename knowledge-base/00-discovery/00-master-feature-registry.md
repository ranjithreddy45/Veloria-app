# VELORIA GRAND — MASTER FEATURE REGISTRY

---

## 📌 Master Feature Catalog Overview

This document provides the granular feature index for the Veloria Grand platform. Every feature maps business purpose to user roles, navigation paths, UI components, server actions, permissions, database models, and side effects.

All paths in this document are **repository-relative**.

---

## 📋 Feature Index by Module

### Module 1: People / HR & Payroll (`src/app/(dashboard)/people/*`)

#### Feature ID: `HR-REIMB-001` — Create & Draft Expense Claim
- **Status Label**: `CODE VERIFIED` | `BRIEF DOCUMENTED`
- **Module**: People / HR & Payroll
- **Feature Name**: Create Reimbursement Claim
- **Business Purpose**: Initiates business expense reimbursement (travel, fuel, client hospitality, office supplies) with receipt image attachments.
- **User Roles**: `STAFF`, `HR_EXECUTIVE`, `HR_MANAGER`, `SALES_EXEC`, `SALES_HEAD`, `EVENT_COORDINATOR`, `OPERATIONS`, `ADMIN`, `SUPER_ADMIN`
- **Route**: `src/app/(dashboard)/people/reimbursements/page.tsx`
- **Navigation Path**: `Dashboard` → `People` → `Reimbursements` → `New Claim`
- **Page File**: `src/app/(dashboard)/people/reimbursements/page.tsx`
- **Main UI Components**: `ReimbursementClaimForm`, `ReceiptUploader`, `CategorySelector`
- **Forms / Dialogs**: `CreateClaimDialog`
- **Client Hooks**: `useForm`, `useMutation`
- **Server Actions**: `createReimbursementClaim()` in `src/actions/hr-reimbursement.actions.ts`
- **API Routes**: None
- **Validation Schemas**: `reimbursementClaimSchema` in `src/schemas/hr.schema.ts`
- **Permission Checks**: `hr:read`
- **Database Models**: `HrReimbursementClaim`, `Employee`, `User`
- **Important Database Fields**: `id`, `employeeId`, `amount`, `category`, `receiptUrl`, `status` (`DRAFT`), `createdAt`
- **Status Lifecycle**: `DRAFT` → `SUBMITTED` → `L1_APPROVED` → `L2_APPROVED` → `PAID` / `REJECTED`
- **Notifications**: In-app push alert to reporting manager upon submission
- **Email**: `sendEmail()` alert
- **WhatsApp**: None
- **Cron / Automation**: None
- **External Integrations**: AWS S3 Presigned URL File Upload
- **File / Storage Dependencies**: S3 bucket key `reimbursements/{claimId}/{filename}`
- **Direct Dependencies**: Active `Employee` record, AWS S3 presigned URL helper (`src/lib/s3.ts`)
- **Reverse Dependencies**: `PayrollEntry` (monthly salary payout inclusion), `FinJournalEntry`
- **Reports / Exports**: Reimbursement Monthly CSV Export
- **Audit Trail**: Created timestamp, `userId` tag
- **Related Features**: Fuel Reimbursement Cap (`HR-REIMB-002`), Claim Approval (`HR-REIMB-005`)
- **Current Implementation Status**: `IMPLEMENTED`
- **Business Brief Reference**: Brief Section 08 (T-15 Expense Management)
- **Exact Code References**: `src/actions/hr-reimbursement.actions.ts#L45-L92`

#### Feature ID: `HR-REIMB-002` — Fuel Litre Cap Validation
- **Status Label**: `CODE VERIFIED` | `BRIEF DOCUMENTED`
- **Module**: People / HR & Payroll
- **Feature Name**: Fuel Expense Validation Engine
- **Business Purpose**: Enforces monthly fuel caps (e.g., 50 Litres/month for Sales Execs) by verifying odometer logs and calculated per-km rates.
- **User Roles**: `SALES_EXEC`, `SALES_HEAD`, `BD_EXECUTIVE`, `OPERATIONS`, `HR_MANAGER`
- **Route**: `src/app/(dashboard)/people/reimbursements/page.tsx`
- **Navigation Path**: `Dashboard` → `People` → `Reimbursements` → `Select Category: Fuel`
- **Page File**: `src/app/(dashboard)/people/reimbursements/page.tsx`
- **Main UI Components**: `FuelClaimInputGroup`, `OdometerDistanceCalculator`
- **Forms / Dialogs**: `CreateClaimDialog`
- **Server Actions**: `validateFuelClaim()` in `src/actions/hr-reimbursement.actions.ts`
- **Validation Schemas**: `fuelClaimSchema` (`litres <= monthlyCap`)
- **Permission Checks**: `hr:read`
- **Database Models**: `HrReimbursementClaim`, `HrPolicyConfig`, `Employee`
- **Important Database Fields**: `distanceKm`, `fuelLitres`, `ratePerKm`, `monthlyCapRemaining`
- **Current Implementation Status**: `IMPLEMENTED`
- **Business Brief Reference**: Brief Section 08 (T-15 Fuel cap rule)
- **Exact Code References**: `src/actions/hr-reimbursement.actions.ts#L120-L165`

#### Feature ID: `HR-REIMB-005` — Multi-Tier Claim Approval Workflow
- **Status Label**: `CODE VERIFIED` | `BRIEF DOCUMENTED`
- **Module**: People / HR & Payroll
- **Feature Name**: Expense Claim Approval Cascade
- **Business Purpose**: Routes submitted expense claims through reporting manager approval (L1), HR policy check (L2), and Finance disbursement approval (L3).
- **User Roles**: `SALES_HEAD`, `HR_MANAGER`, `FINANCE`, `ADMIN`, `SUPER_ADMIN`
- **Route**: `src/app/(dashboard)/approvals/page.tsx`
- **Navigation Path**: `Dashboard` → `Approvals` → `Pending Reimbursements` → `Approve / Reject`
- **Page File**: `src/app/(dashboard)/approvals/page.tsx`
- **Main UI Components**: `ApprovalCard`, `ReceiptViewerModal`
- **Server Actions**: `approveReimbursementStage()` in `src/actions/hr-reimbursement.actions.ts`
- **Permission Checks**: `hr:write`, `finance:read`
- **Database Models**: `HrReimbursementClaim`, `ApprovalLog`
- **Important Database Fields**: `status` (`SUBMITTED` → `L1_APPROVED` → `L2_APPROVED` → `PAID` / `REJECTED`)
- **Current Implementation Status**: `IMPLEMENTED`
- **Exact Code References**: `src/actions/hr-reimbursement.actions.ts#L210-L315`

---

### Module 2: CRM & Lead Acquisition (`src/app/(dashboard)/leads/*`, `src/app/(dashboard)/pipeline/*`)

#### Feature ID: `CRM-LEAD-001` — Multi-Channel Webhook Lead Ingestion
- **Status Label**: `CODE VERIFIED` | `BRIEF DOCUMENTED`
- **Module**: CRM & Lead Management
- **Feature Name**: Inbound Lead Capture
- **Business Purpose**: Ingests leads from Google Ads, Facebook Ads, Website Widget, and Runo Telephony calls into the CRM pipeline.
- **User Roles**: System (Unauthenticated Webhooks / API Keys)
- **Route**: `src/app/api/webhooks/google-ads/route.ts`, `src/app/api/webhooks/facebook-leads/route.ts`
- **Server Actions**: `ingestLead()` in `src/lib/lead-capture.ts`
- **Database Models**: `Lead`, `WidgetInquiry`, `Contact`
- **Important Database Fields**: `source`, `campaign`, `customerName`, `phone`, `email`, `budget`, `guestCount`
- **Current Implementation Status**: `IMPLEMENTED`
- **Business Brief Reference**: Brief Section 03 & Section 07 (C-01 Lead Capture)
- **Exact Code References**: `src/lib/lead-capture.ts#L15-L110`

#### Feature ID: `CRM-LEAD-002` — AI Lead Scoring & Intent Evaluation
- **Status Label**: `CODE VERIFIED` | `BRIEF DOCUMENTED`
- **Module**: CRM & Lead Management
- **Feature Name**: AI Lead Quality Scoring
- **Business Purpose**: Evaluates lead conversion probability via OpenAI based on budget, guest count, event date, and campaign source.
- **User Roles**: `SYSTEM` (Cron), `SALES_HEAD`, `ADMIN`
- **Route**: `src/app/api/cron/ai-scoring/route.ts`
- **Server Actions**: `computeAiLeadScore()` in `src/actions/ai.actions.ts`
- **Cron / Automation**: `src/app/api/cron/ai-scoring/route.ts` (Runs hourly)
- **External Integrations**: OpenAI GPT-4 API
- **Database Models**: `Lead` (`score`, `aiQualityTier`, `scoringSummary`)
- **Current Implementation Status**: `IMPLEMENTED`
- **Business Brief Reference**: Brief Section 08 (T-02 AI Scoring)
- **Exact Code References**: `src/actions/ai.actions.ts#L30-L95`

---

### Module 3: Quotations & Pricing (`src/app/(dashboard)/quotations/*`)

#### Feature ID: `QUOTE-PRICING-001` — Seasonal & Auspicious Date Dynamic Yield Pricing
- **Status Label**: `CODE VERIFIED` | `BRIEF DOCUMENTED`
- **Module**: Quotations & Pricing
- **Feature Name**: Yield Pricing Matrix Calculation
- **Business Purpose**: Adjusts venue package prices dynamically based on peak wedding dates (Saava dates), day of week, and time slot.
- **User Roles**: `SALES_EXEC`, `SALES_HEAD`, `FINANCE`, `ADMIN`
- **Route**: `src/app/(dashboard)/quotations/new/page.tsx`
- **Server Actions**: `calculateQuotationPrice()` in `src/actions/pricing.actions.ts`
- **Database Models**: `PricingRule`, `SalesQuotation`, `Venue`, `EventPackage`
- **Current Implementation Status**: `IMPLEMENTED`
- **Exact Code References**: `src/actions/pricing.actions.ts#L10-L105`

---

### Module 4: Invoicing, Payments & Razorpay (`src/app/(dashboard)/invoices/*`, `src/app/pay/*`)

#### Feature ID: `FIN-PAY-001` — Razorpay Instant Payment Link Checkout & Webhook Settlement
- **Status Label**: `CODE VERIFIED` | `BRIEF DOCUMENTED`
- **Module**: Invoicing & Payments
- **Feature Name**: Razorpay Online Payment Checkout
- **Business Purpose**: Generates payment links for advance bookings and installments, auto-reconciling payments into the ledger upon webhook verification.
- **User Roles**: `FINANCE`, `SALES_EXEC`, `CLIENT` (Public Checkout)
- **Route**: `src/app/pay/[token]/page.tsx`, `src/app/api/payments/webhook/route.ts`
- **Server Actions**: `createRazorpayPaymentOrder()` in `src/actions/payment.actions.ts`
- **External Integrations**: Razorpay Gateway SDK (`razorpay`)
- **Database Models**: `Invoice`, `Payment`, `FinJournalEntry`, `Booking`
- **Current Implementation Status**: `IMPLEMENTED`
- **Business Brief Reference**: Brief Section 07 (C-09 Online Payment & Receipt)
- **Exact Code References**: `src/actions/payment.actions.ts#L15-L110`, `src/app/api/payments/webhook/route.ts#L1-L85`
