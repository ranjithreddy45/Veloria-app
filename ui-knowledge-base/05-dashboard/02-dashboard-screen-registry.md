# DASHBOARD SCREEN REGISTRY

## 1. Registry Summary

The Veloria Grand application contains 10 distinct dashboard surfaces serving specialized operational functions across departments.

---

## 2. Comprehensive Screen Registry

### SCREEN-0501: Primary Team Home (`/dashboard`)
- **Route**: `/dashboard`
- **File**: [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/dashboard/page.tsx)
- **Dashboard Type**: Executive & Multi-Lens Department Dashboard
- **Primary Roles**: All Staff (`ADMIN`, `GENERAL_MANAGER`, `SALES`, `OPS`, `FINANCE`, `HR`, `KITCHEN`)
- **Layout**: 12-column grid layout (8 cols Attention Feed, 4 cols Side Card)
- **Widgets**: `WIDGET-0501` (Home KPIs), `WIDGET-0502` (Attention Feed), `WIDGET-0503` (Side Card), `WIDGET-0504` (Activity Feed), `WIDGET-0505` (Getting Started), `WIDGET-0506` (Welcome Tour)
- **Server Action**: `getHomeView()` ([home.actions.ts](file:///Users/fci/Documents/Veloria-app/src/actions/home.actions.ts))
- **Status**: Verified from Source Code.

### SCREEN-0502: Analytics & Business Intelligence (`/analytics`)
- **Route**: `/analytics`
- **File**: [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/analytics/page.tsx)
- **Dashboard Type**: Analytics & Intelligence Dashboard
- **Primary Roles**: `ADMIN`, `GENERAL_MANAGER`, `FINANCE`
- **Widgets**: Revenue trend charts, lead source attribution pie chart, conversion funnel graph, monthly forecasting card.
- **Server Action**: `getAnalyticsSummary()`
- **Status**: Verified from Source Code.

### SCREEN-0503: Finance Command Center (`/finance/command-center`)
- **Route**: `/finance/command-center`
- **File**: [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/finance/command-center/page.tsx)
- **Dashboard Type**: Financial Operations Dashboard
- **Primary Roles**: `FINANCE`, `ADMIN`
- **Widgets**: Receivables ledger, payment proof verification queue, cash flow forecast chart, invoice anomaly alerts.
- **Status**: Verified from Source Code.

### SCREEN-0504: Sales & Lead CRM Dashboard (`/leads`)
- **Route**: `/leads`
- **File**: [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/leads/page.tsx)
- **Dashboard Type**: Sales Pipeline Dashboard
- **Primary Roles**: `SALES`, `ADMIN`
- **Widgets**: Lead Kanban board, SLA breach banner, conversion rate metrics, lead assignment table.
- **Status**: Verified from Source Code.

### SCREEN-0505: Operations & BEO Command Center (`/beo`)
- **Route**: `/beo`
- **File**: [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/beo/page.tsx)
- **Dashboard Type**: Operations & Event Execution Dashboard
- **Primary Roles**: `OPS`, `ADMIN`
- **Widgets**: Daily event timelines, BEO approval status, venue allocation board, staffing schedules.
- **Status**: Verified from Source Code.

### SCREEN-0506: Kitchen Operations Dashboard (`/kitchen`)
- **Route**: `/kitchen`
- **File**: [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/kitchen/page.tsx)
- **Dashboard Type**: Culinary & Food Production Dashboard
- **Primary Roles**: `KITCHEN`, `OPS`
- **Widgets**: Meal cover counter, menu item prep breakdown, allergen warnings, inventory dispatch list.
- **Status**: Verified from Source Code.

### SCREEN-0507: Vendor & Procurement Dashboard (`/procurement`)
- **Route**: `/procurement`
- **File**: [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/procurement/page.tsx)
- **Dashboard Type**: Procurement & Supplier Dashboard
- **Primary Roles**: `OPS`, `FINANCE`, `ADMIN`
- **Widgets**: Purchase Order status table, vendor rating matrix, pending RFQ quotes, payout approvals.
- **Status**: Verified from Source Code.

### SCREEN-0508: HR & Employee Central Dashboard (`/people`)
- **Route**: `/people`
- **File**: [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/people/page.tsx)
- **Dashboard Type**: HR & Workforce Management Dashboard
- **Primary Roles**: `HR`, `ADMIN`
- **Widgets**: Attendance summary, leave request approvals, payroll disbursement status, active employee roster.
- **Status**: Verified from Source Code.

### SCREEN-0509: Performance & Leaderboard Dashboard (`/performance/leaderboard`)
- **Route**: `/performance/leaderboard`
- **File**: [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/performance/leaderboard/page.tsx)
- **Dashboard Type**: Gamification & Performance Dashboard
- **Primary Roles**: All Staff
- **Widgets**: Velos points leaderboard table, top sales reps cards, monthly badge achievements, incentive trackers.
- **Status**: Verified from Source Code.

### SCREEN-0510: WhatsApp & Comms Command Center (`/whatsapp/console`)
- **Route**: `/whatsapp/console`
- **File**: [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/whatsapp/console/page.tsx)
- **Dashboard Type**: Communications & Messaging Dashboard
- **Primary Roles**: `SALES`, `OPS`, `ADMIN`
- **Widgets**: 24-hour session window indicator, live chat inbox, AI copilot prompt suggest, template selector.
- **Status**: Verified from Source Code.
