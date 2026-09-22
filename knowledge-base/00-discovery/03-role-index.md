# VELORIA GRAND — USER ROLE INDEX & PERMISSION MATRIX

---

## 📌 Implemented User Roles

- **Status Label**: `CODE VERIFIED`
- **Enum Source**: `UserRole` in `prisma/schema.prisma`
- **Permission Matrix File**: `src/lib/permissions.ts`
- **Total Implemented Roles**: **23 Roles**

---

## 👥 Role Summary Matrix

| UserRole Enum | Explicit Permission Count | Accessible Modules | Primary Restrictions |
|---|---|---|---|
| `SUPER_ADMIN` | **Wildcard Bypass** (All) | Full System Access | None |
| `ADMIN` | **226 permissions** | All Dashboard, HR, Finance, Settings | Cannot edit Super Admin system logs |
| `SALES_EXEC` | **56 permissions** | Leads, Pipeline, Quotes, Contacts | Cannot approve special discounts or delete leads |
| `SALES_HEAD` | **71 permissions** | All Sales + Rep Allocation, Discounts | Cannot alter financial GL accounts |
| `EVENT_COORDINATOR`| **68 permissions** | Bookings, BEO, Tasks, Timelines | Cannot modify master pricing or cancel invoices |
| `FINANCE` | **51 permissions** | Invoices, Payments, GL, Payouts, Payroll | Cannot alter lead pipeline stages |
| `STAFF` | **10 permissions** | My-Work, Tasks, Self HR (Leave/Attendance)| Restricted strictly to assigned tasks & self HR |
| `CLIENT` | **4 permissions** | Client Portal (`src/app/(portal)/*`) | Restricted strictly to own booking |
| `VENDOR` | **3 permissions** | Vendor Portal (`src/app/(vendor-portal)/*`)| Restricted strictly to assigned work packages |
| `BD_EXECUTIVE` | **7 permissions** | BD Deals, Landlord Contacts, Site Notes | No access to event bookings or financial GL |
| `BD_HEAD` | **9 permissions** | BD Pipeline, Deal Approvals, Capex | No access to customer lead CRM or HR payroll |
| `OPERATIONS` | **27 permissions** | BEO, Kitchen Prep, Shift Rosters | Cannot access client payment details |
| `OPERATIONS_HEAD` | **35 permissions** | All Operations + Vendor Payout Approvals | Cannot edit HR tax settings |
| `PROPERTY_MANAGER` | **13 permissions** | Venue Facilities, Maintenance | Cannot access sales quotations |
| `PROJECTS_EXEC` | **11 permissions** | Venue Renovation Projects | No access to customer lead CRM |
| `PROJECTS_HEAD` | **14 permissions** | Project Approvals, Capex Budgets | Cannot approve customer refunds |
| `DESIGN_EXEC` | **6 permissions** | Event Layout Design, Floor Plan Lab | No access to financial accounts |
| `DESIGN_HEAD` | **8 permissions** | Floor Plan Approval, Templates | No access to sales pipeline |
| `LEGAL` | **3 permissions** | Contract Templates, Legal Review | No operational task access |
| `MARKETING` | **15 permissions** | Campaigns, WhatsApp Marketing | Cannot modify sales deal stages |
| `HR_MANAGER` | **11 permissions** | Employee Records, Payroll Sheet | Cannot modify sales pricing |
| `HR_EXECUTIVE` | **6 permissions** | Recruitment Log, Daily Attendance | Cannot approve salary sheets |
| `AUDITOR` | **6 permissions** | Read-Only Audit Logs, Reports | Strictly Read-Only |
