# Role-Navigation Visibility Matrix

## 1. Permissions & Visibility Rule
An item is rendered in the sidebar if the active user holds **ANY** of the permissions listed in `item.permissions`.
If `item.permissions` is empty (`[]`), the item is visible to **ALL authenticated users** (e.g. `My HR` self-service section).

## 2. Key Role Profiles & Visible Module Summary

| Role Name | Key Visible Modules | Key Hidden Modules |
|---|---|---|
| `SUPER_ADMIN` | All 31 Modules | None |
| `GENERAL_MANAGER` | Dashboard, Sales, Bookings, Operations, Finance, Analytics | Settings: Users/Roles |
| `SALES_DIRECTOR` | Dashboard, Sales CRM, Engagement, Bookings, Marketing | HR Admin, Payroll |
| `SALES_EXECUTIVE` | Dashboard, Sales CRM, My Calendar, Bookings, My HR | Finance, HR Admin, Settings |
| `EVENT_MANAGER` | Dashboard, Bookings, Event Operations (BEO), Tasks | Payroll, BD CRM |
| `BEO_COORDINATOR` | Event Operations (BEO), Kitchen prep, Tasks | Finance, HR Admin |
| `KITCHEN_CHEF` | Event Operations -> Kitchen & F&B, Menu, Inventory | Sales CRM, Finance |
| `PROCUREMENT_MANAGER`| Supply Chain -> Procurement, Vendors, Payables | Sales CRM, Recruitment |
| `FINANCE_DIRECTOR` | Accounting, Treasury & Planning, Billing, Payables | Recruitment, Marketing |
| `ACCOUNTANT` | Accounting -> General Ledger, Bank, Invoices, Vendor Bills | HR Admin, Settings |
| `HR_DIRECTOR` | People, Time & Attendance, Performance, HR Admin, Payroll | Accounting, BD CRM |
| `HR_EXECUTIVE` | People, Attendance, Leave, Recruitment, My HR | Finance, Settings |
| `RECRUITER` | Recruitment -> Jobs, Candidates, Applications, Offers | Finance, Accounting |
| `BD_MANAGER` | BD CRM -> Dashboard, Leads, Deals, Contracts, Properties | Payroll, Kitchen |
| `MARKETING_MANAGER` | Marketing, Engagement, Campaigns, Referrals, Analytics | Payroll, Accounting |
| `EMPLOYEE_USER` | My HR -> Attendance, Leave, Payslips, Reimbursements, Handbook | HR Admin, Payroll, Finance |
