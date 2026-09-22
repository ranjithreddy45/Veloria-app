# Role Access Across Application Modules

## Overview

This reference details role accessibility and primary capabilities across all major functional modules of Veloria Grand.

---

## Module Access Summary

### 1. Core & Administration
- **Modules**: System Settings, User Management, Audit Logs, Role Permissions.
- **Primary Roles**: `SUPER_ADMIN`, `ADMIN`.
- **Restrictions**: Restricted from all standard internal and portal staff roles.

### 2. Sales & CRM
- **Modules**: Leads, Sales Pipeline, Quotations, Contracts, Client Management.
- **Primary Roles**: `SALES_EXEC`, `SALES_HEAD`, `BD_EXECUTIVE`, `BD_HEAD`, `ADMIN`, `SUPER_ADMIN`.
- **Approval Authority**: `SALES_HEAD` approves custom quotations and contract discounts.

### 3. Events & Operations
- **Modules**: Bookings, Event Calendar, Banquet Event Orders (BEO), Floor Plans, Kitchen Orders.
- **Primary Roles**: `EVENT_COORDINATOR`, `OPERATIONS`, `OPERATIONS_HEAD`, `ADMIN`, `SUPER_ADMIN`.
- **Approval Authority**: `OPERATIONS_HEAD` approves BEO executions and inventory disbursements.

### 4. Finance & Accounting
- **Modules**: Invoices, Payments, Financial Reports, Tax & Billing, Vendor Payouts.
- **Primary Roles**: `FINANCE`, `AUDITOR` (Read-only), `ADMIN`, `SUPER_ADMIN`.
- **Approval Authority**: `FINANCE` performs final disbursement approvals.

### 5. Human Resources & Staff Management
- **Modules**: Employee Profiles, Attendance, Leave Management, Payroll, Reimbursements, Recruitment.
- **Primary Roles**: `HR_MANAGER`, `HR_EXECUTIVE`, `ADMIN`, `SUPER_ADMIN`.
- **Approval Authority**: `HR_MANAGER` approves leaves, recruitments, and payroll runs.

### 6. Property & Business Development
- **Modules**: Property Master, Venue Amenities, Landlord Agreements, BD Prospects.
- **Primary Roles**: `PROPERTY_MANAGER`, `BD_EXECUTIVE`, `BD_HEAD`, `LEGAL`, `ADMIN`, `SUPER_ADMIN`.

### 7. Projects & Design
- **Modules**: Venue Renovations, Interior Layouts, Project Timelines.
- **Primary Roles**: `PROJECTS_EXEC`, `PROJECTS_HEAD`, `DESIGN_EXEC`, `DESIGN_HEAD`.

### 8. Legal & Marketing
- **Modules**: Legal Contracts, Compliance Documents, Marketing Campaigns, Communications.
- **Primary Roles**: `LEGAL`, `MARKETING`.

### 9. Portals & External Access
- **Modules**: Client Self-Service Portal, Vendor Portal.
- **Primary Roles**: `CLIENT`, `VENDOR`.
- **Restrictions**: Strictly isolated from internal administrative routes and cross-tenant data.
