# 01 Analytics & Audit Landscape Overview

`CODE VERIFIED`

## Subsystem Architecture Overview

The Veloria Grand Analytics, Reporting, Audit, and Observability layer provides comprehensive data intelligence across business units. Rather than relying on third-party BI software (e.g. Tableau, Looker), analytics are calculated directly from the PostgreSQL database using Prisma ORM within Next.js Server Actions (`src/actions/*`), API route handlers (`src/app/api/*`), and automated background cron jobs (`src/app/api/cron/*`).

```
+-----------------------------------------------------------------------------------+
|                        VELORIA GRAND ANALYTICS & AUDIT HUB                        |
+-----------------------------------------------------------------------------------+
       |                     |                    |                   |
       v                     v                    v                   v
+--------------+      +--------------+     +--------------+    +--------------------+
| FINANCIAL BI |      | SALES & CRM  |     | HR & PAYROLL |    | SYSTEM AUDIT &     |
|  (/finance)  |      | (/analytics) |     |  (/people)   |    |  ANOMALIES         |
+--------------+      +--------------+     +--------------+    +--------------------+
| GL Journals  |      | Lead Funnel  |     | Muster Roll  |    | ActivityLog        |
| Cash Flow    |      | Attribution  |     | PF/ESI/PT    |    | FinAnomaly         |
| P&L / B/S    |      | Forecast     |     | Salary Sheet |    | CronRunLog         |
+--------------+      +--------------+     +--------------+    +--------------------+
```

## Master Analytics & Reporting Surfaces Table

| Business Domain | Primary Route | Primary Dashboard / Report | Data Models | Calculation Source | Export Formats | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Executive BI** | `/analytics` | Command Center Overview | `Booking`, `Invoice`, `Payment`, `Lead` | `analytics.actions.ts` | PDF, XLSX | `IMPLEMENTED` |
| **Sales & Pipeline** | `/sales/reports`, `/analytics/forecast` | Sales Velocity & Pipeline Forecast | `Lead`, `Deal`, `SalesQuotation`, `Booking` | `sales-analytics.actions.ts`, `forecast.actions.ts` | CSV, XLSX | `IMPLEMENTED` |
| **Marketing Attribution** | `/reports/marketing-attribution` | Closed-Loop Attribution & ROAS | `MarketingCampaign`, `LeadAttribution`, `Booking` | `attribution-analytics.actions.ts` | CSV | `IMPLEMENTED` |
| **Financial Ledger** | `/finance/command-center`, `/finance/reports` | Trial Balance, P&L, Balance Sheet, Cash Flow | `FinJournalEntry`, `FinJournalLine`, `FinBudget` | `finance-profitability.actions.ts`, `finance-cashflow.actions.ts` | PDF, Excel, Tally XML | `IMPLEMENTED` |
| **Finance Anomalies** | `/finance/anomalies`, `/analytics/anomalies` | Financial Anomaly & Fraud Monitor | `FinAnomaly`, `FinJournalEntry`, `Invoice` | `finance-anomaly.actions.ts`, `anomaly.actions.ts` | CSV | `IMPLEMENTED` |
| **HR & Headcount** | `/people/analytics`, `/people/reports` | Headcount, Attrition, Tenure | `Employee`, `Department`, `EmployeeStatutory` | `hr-analytics.actions.ts`, `hr-report-employee.actions.ts` | XLSX, PDF | `IMPLEMENTED` |
| **Attendance & Muster** | `/people/reports/attendance` | Monthly Muster Roll, Late/Early, Absenteeism | `AttendanceRecord`, `MonthlyAttendanceSheet` | `hr-report-attendance.actions.ts` | PDF, XLSX | `IMPLEMENTED` |
| **Payroll & Statutory** | `/people/reports/salary`, `/people/reports/statutory` | Salary Register, PF/ESI/PT Statements | `HrPayrollRun`, `HrPayslip`, `EmployeeStatutory` | `hr-report-salary.actions.ts`, `hr-statutory-reports.actions.ts` | CSV, XLSX, Govt Portal Formats | `IMPLEMENTED` |
| **Performance & KRA** | `/people/performance`, `/performance` | KRA Scorecard & Velos Leaderboard | `KraScorecard`, `PerformanceScore`, `VelosLedger` | `hr-performance.actions.ts`, `performance.actions.ts` | CSV | `IMPLEMENTED` |
| **BD & Property** | `/bd/reports` | Acquisition Pipeline & Projections | `AcqLead`, `AcqDeal`, `AcqProperty`, `AcqProjection` | `acq-analytics.actions.ts`, `acq-reports.actions.ts` | PDF, XLSX | `IMPLEMENTED` |
| **Audit & Activity** | `/settings/activity-log` | System Audit Trail & Event Log | `ActivityLog`, `CronRunLog`, `ProjectAuditLog` | `activity.actions.ts`, `agent-activity.actions.ts` | CSV | `IMPLEMENTED` |
