# Sidebar Structure & Component Breakdown

## 1. Structural Layout
The App Sidebar is rendered inside `src/components/layout/app-sidebar.tsx` and structured into 5 primary zones:

1. **Header Zone**: Brand Logo (`BrandLogo`), Venue Switcher, Version Badge (`VersionBadge`).
2. **Pinned Items Zone**: Workspace Pins bar rendering up to 6 custom-pinned shortcuts (`useWorkspacePins`).
3. **Main Navigation Zone**: Multi-level collapsible module sections (`SidebarGroup`, `SidebarMenu`).
4. **User Profile & Quick Tools Zone**: Active alerts popup (`ActiveAlertsPopup`), Pending approvals chip (`PendingApprovalsChip`), Velos chip (`VelosChip`), User avatar dropdown menu.
5. **Sidebar Rail Zone**: Resize and collapse toggle handle (`SidebarRail`).

## 2. Main Navigation Sections (31 Major Module Groups)
1. **Dashboard**: Main executive overview (`/dashboard`).
2. **My Work**: Personalized task list (`/my-work`).
3. **Team Chat**: Internal messaging (`/chat`).
4. **Playbook**: Operational standard playbooks (`/playbook`).
5. **BD CRM**: Property acquisition, hall owners & deals (`/bd/dashboard`).
6. **Sales CRM**: Lead management, enquiry, pipeline & quotes (`/contacts`).
7. **Engagement**: Cadences, signals, WhatsApp, email tracking (`/crm/cadences`).
8. **Bookings**: All event bookings, calendar, availability & concierge (`/bookings`).
9. **Projects**: Venues, portfolio, CapEx rate cards & vendors (`/projects`).
10. **Operations**: Tasks, task templates, staff & SOP templates (`/tasks`).
11. **Event Operations**: Function sheets (BEO), kitchen & F&B (`/beo`).
12. **Supply Chain**: Procurement, logistics & dispatch (`/procurement`).
13. **Support**: Customer & internal support tickets (`/support`).
14. **Recruitment**: Openings, candidates, applications & offers (`/recruitment`).
15. **My HR**: Employee self-service attendance, leave, payslips & reimbursements (`/me/attendance`).
16. **People**: Employee directory, org chart & handbook (`/people`).
17. **Time & Attendance**: Shifts, attendance, leave, holidays & muster (`/people/attendance`).
18. **Performance**: Reviews, OKRs, engagement & LMS (`/people/performance`).
19. **HR Admin**: Analytics, reports, compensation & settings (`/people/analytics`).
20. **Payroll**: Attendance sheet, runs, disbursement, advances & statutory (`/people/payroll`).
21. **Catalog**: Packages, menu, pricing, yield pricing & inventory (`/packages`).
22. **Accounting**: General ledger, bank reconciliation, tax & profitability (`/finance`).
23. **Treasury & Planning**: Command center, cash flow, budgets & anomalies (`/finance/command-center`).
24. **Billing**: Invoices & payment processing (`/invoices`).
25. **Payables & Assets**: Payouts, vendor bills, commissions & fixed assets (`/payouts`).
26. **Marketing**: Campaigns, win-back, accounts, loyalty & referrals (`/campaigns`).
27. **Analytics**: Reports, attribution, Quality/Six Sigma, KRA scorecards & anomalies (`/reports`).
28. **Documents**: Central document repository (`/documents`).
29. **Gallery**: Venue photo & media gallery (`/gallery`).
30. **Franchise**: Franchise partner management & onboarding (`/franchise`).
31. **Settings**: Venues, users, roles, workflows, integrations & health (`/settings`).
