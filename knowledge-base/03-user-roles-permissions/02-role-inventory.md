# CHUNK 03-02 — ROLE INVENTORY

- **Status**: `CODE VERIFIED`
- **Module**: Roles & RBAC System
- **Target Path**: `knowledge-base/03-user-roles-permissions/02-role-inventory.md`

---

## 👥 Master Role Inventory Table (23 Implemented Roles)

The table below catalogs all 23 user roles defined in `UserRole` enum (`prisma/schema.prisma`):

| Role Enum | Display Name | Category | Primary Responsibility | Route Access Scope | Granted Perms Count | Portal Access |
|---|---|---|---|---|---|---|
| `SUPER_ADMIN` | Super Administrator | Executive | Full system ownership, system config, wildcard bypass | All Routes | **Wildcard (244)** | All Portals |
| `ADMIN` | General Manager / Admin | Management | Overall venue operations, staff oversight, full permissions | All Routes | **226 perms** | All Portals |
| `SALES_EXEC` | Sales Executive | Commercial | Lead response, quotation generation, site visits | Dashboard, Leads, Pipeline, Quotes | **56 perms** | None |
| `SALES_HEAD` | Sales Director / Head | Commercial | Sales team oversight, discount approvals, lead allocation | All Sales + Approvals | **71 perms** | None |
| `EVENT_COORDINATOR`| Event Manager | Operations | Booking coordination, client event planning, BEO reviews | Bookings, BEO, Tasks, Timelines | **68 perms** | Client Portal |
| `FINANCE` | Finance Manager | Accounting | Invoices, Razorpay link generation, GL ledger, Payouts | Invoices, Payments, Finance, Payouts | **51 perms** | None |
| `STAFF` | General Employee | Staff | Personal tasks, attendance clock-in, expense claims | My Work, Attendance, Leave | **10 perms** | None |
| `CLIENT` | Event Host / Client | External | Client portal access, invoice viewing, payment checkout | Client Portal (`src/app/(portal)`) | **4 perms** | Client Portal |
| `VENDOR` | External Partner | External | Vendor workstation, bidding on work packages, claims | Vendor Portal (`src/app/(vendor-portal)`) | **3 perms** | Vendor Portal |
| `BD_EXECUTIVE` | BD Acquisition Exec | Acquisition | B2B landlord contacts, property lead collection | BD CRM, Landlord Directory | **7 perms** | None |
| `BD_HEAD` | BD Department Head | Acquisition | Property deal approvals, Capex projection models | BD Pipeline, Capex Models | **9 perms** | None |
| `OPERATIONS` | Operations Staff | Operations | BEO execution, kitchen prep, venue readiness | BEO, Kitchen, Inventory, Tasks | **27 perms** | None |
| `OPERATIONS_HEAD` | Operations Director | Operations | Operations team oversight, vendor payout reviews | All Operations + Vendor Payouts | **35 perms** | None |
| `PROPERTY_MANAGER` | Facility Manager | Property | Venue facility maintenance, stock asset tracking | Venue Master, Maintenance | **13 perms** | None |
| `PROJECTS_EXEC` | Projects Engineer | Projects | Venue renovation tasks, vendor work package tracking | Venue Projects, Work Orders | **11 perms** | None |
| `PROJECTS_HEAD` | Projects Lead | Projects | Project budget approvals, Capex project tracking | Projects Pipeline, Capex | **14 perms** | None |
| `DESIGN_EXEC` | Event Designer | Creative | Event floor plan layout design, theme templates | Design Lab, Layout Studio | **6 perms** | None |
| `DESIGN_HEAD` | Creative Director | Creative | Layout approvals, master design template management | Design Lab, Master Templates | **8 perms** | None |
| `LEGAL` | Legal Counsel | Governance | Contract template updates, legal review logs | Contracts, E-Sign Logs | **3 perms** | None |
| `MARKETING` | Marketing Specialist| Marketing | Ad campaign tracking, WhatsApp marketing, social posts | Marketing, WhatsApp, Referrals | **15 perms** | None |
| `HR_MANAGER` | HR Manager | People | Employee records, salary sheet calculation, HR policy | People, Payroll, Attendance | **11 perms** | None |
| `HR_EXECUTIVE` | HR Executive | People | Attendance sheet review, recruitment candidate logs | People, Recruitment, Attendance | **6 perms** | None |
| `AUDITOR` | System Auditor | Compliance | Read-only compliance audit trail inspection | Reports, Activity Logs | **6 perms (Read)** | None |
