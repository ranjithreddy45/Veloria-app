# Phase 9: Master Role & Permission Matrix

## 1. 23 Verified Roles
1. `SUPER_ADMIN` - Complete system bypass and configuration rights.
2. `GENERAL_MANAGER` - Executive operational & financial oversight.
3. `SALES_DIRECTOR` - Complete sales, quotation & CRM control.
4. `SALES_EXECUTIVE` - Lead management, quote generation.
5. `EVENT_MANAGER` - Event booking execution, calendar management.
6. `BEO_COORDINATOR` - BEO drafting, locks, readiness gates.
7. `KITCHEN_CHEF` - Recipe management, stock deduction requests.
8. `INVENTORY_MANAGER` - Stock items, warehouse movements, reorder alerts.
9. `PROCUREMENT_MANAGER` - Purchase requisitions, PO creation, vendor bills.
10. `FINANCE_DIRECTOR` - Chart of accounts, period locking, manual GL posting.
11. `ACCOUNTANT` - AR/AP processing, invoice creation, payment entries.
12. `HR_DIRECTOR` - HR policy, salary structure, payroll approval.
13. `HR_EXECUTIVE` - Employee profiles, attendance logs, leave processing.
14. `RECRUITER` - Candidate interviewing, offer creation.
15. `BD_MANAGER` - Property lead acquisition, deal pipeline.
16. `MARKETING_MANAGER` - Ad campaigns, WhatsApp templates, attribution.
17. `COMMUNICATIONS_SPECIALIST` - Multi-channel customer messages.
18. `CLIENT_USER` - Client Portal access for quote/invoice/contract.
19. `VENDOR_USER` - Vendor Portal access for bids and work orders.
20. `EMPLOYEE_USER` - Self-service profile, attendance, leave, payslips.
21. `AUDITOR` - Read-only access to all financial, system, and audit logs.
22. `SYSTEM_BOT` - Background service account for cron & webhook automation.
23. `CAPACITOR_MOBILE_USER` - Mobile wrapper profile access.

## 2. Access Boundaries & Matrices
- **Financial Access**: `SUPER_ADMIN`, `GENERAL_MANAGER`, `FINANCE_DIRECTOR`, `ACCOUNTANT`, `AUDITOR`.
- **HR & Payroll Access**: `SUPER_ADMIN`, `HR_DIRECTOR`, `HR_EXECUTIVE`, `ACCOUNTANT` (disbursement view).
- **Portal Access**: `CLIENT_USER` (`/portal/*`), `VENDOR_USER` (`/vendor-portal/*`).
