# Internal Dashboard Routes (395 Endpoints)

## Overview

The internal dashboard represents the primary operational hub of Veloria Grand, containing 395 page routes accessible exclusively to authenticated staff, executive, and administrative roles.

---

## Core Dashboard Modules & Route Clusters

### 1. Sales & Lead CRM Cluster (`/sales`, `/leads`, `/quotations`)
- **`/leads`**: Lead acquisition list and filtering dashboard. (`sales:read`)
- **`/leads/[id]`**: Lead detail view, interaction timeline, AI score, and assignment. (`sales:read`)
- **`/leads/new`**: Lead creation form. (`sales:create`)
- **`/quotations`**: Quotation builder and pricing engine list. (`quotations:read`)
- **`/quotations/[id]`**: Quotation detail, line items, and discount request. (`quotations:read`)
- **`/contracts`**: Digital contract tracking and signature status. (`contracts:read`)

### 2. Events & Operations Cluster (`/events`, `/beo`, `/calendar`)
- **`/events`**: Master event calendar and booking schedule. (`events:read`)
- **`/events/[id]`**: Event execution detail, floor plan, and guest list. (`events:read`)
- **`/beo`**: Banquet Event Order (BEO) master list. (`beo:read`)
- **`/beo/[id]`**: BEO detail, kitchen prep sheet, and timeline setup. (`beo:read`)
- **`/beo/[id]/print`**: Printable BEO sheet layout. (`beo:read`)

### 3. HR & Employee Central Cluster (`/hr`, `/employees`, `/payroll`)
- **`/hr`**: HR department overview and headcount analytics. (`hr:read`)
- **`/employees`**: Employee directory and organogram. (`employees:read`)
- **`/employees/[id]`**: Employee profile, salary structure, and documents. (`employees:read`)
- **`/attendance`**: Attendance clock-in log and roster verification. (`attendance:read`)
- **`/leave`**: Leave requests and approval queue. (`leave:read`)
- **`/payroll`**: Monthly payroll processing and tax breakdown. (`payroll:read`)
- **`/reimbursements`**: Employee expense claims and approval queue. (`reimbursements:read`)

### 4. Finance & Accounting Cluster (`/finance`, `/invoices`, `/payments`)
- **`/finance`**: General Ledger, income statement, and balance sheet. (`finance:read`)
- **`/invoices`**: Billing invoice list and GST breakdown. (`invoices:read`)
- **`/invoices/[id]`**: Invoice detail and payment recording. (`invoices:read`)
- **`/payments`**: Payment transaction log and Razorpay reconciliations. (`payments:read`)

### 5. Vendors & Procurement Cluster (`/vendors`, `/procurement`)
- **`/vendors`**: Supplier directory and performance scorecards. (`vendors:read`)
- **`/procurement`**: Purchase orders (PO) and work package bidding. (`procurement:read`)
- **`/inventory`**: Kitchen stock and warehouse inventory tracking. (`inventory:read`)

### 6. System Administration Cluster (`/settings`, `/users`)
- **`/settings`**: Organization settings, email SMTP, payment gateway keys. (`settings:manage`)
- **`/users`**: Staff user account management and role assignment. (`users:manage`)
- **`/rbac`**: Dynamic role permission editor. (`rbac:manage`)
