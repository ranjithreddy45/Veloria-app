# 23 Analytics & Audit Subsystem Knowledge Base

Status: `COMPLETE`  
Documentation Date: 2026-09-22  
Source of Truth: Actual repository implementation  
Source Modifications: 0  
Schema Modifications: 0  
Migration Modifications: 0  

---

## Executive Summary

The **Veloria Grand Analytics, Reporting, Audit, and Observability Subsystem** delivers comprehensive real-time and scheduled business intelligence, financial reporting, and security auditing across all business units.

Calculated directly from the PostgreSQL production database using Prisma ORM in Next.js Server Actions and API handlers, the analytics infrastructure supports CFO financial reports (Trial Balance, P&L, Balance Sheet, Tally XML), Sales & Marketing attribution (closed-loop ROAS, CPL, CAC), HR muster rolls and statutory tax returns (PF, ESI, PT), and an immutable system-wide audit logging architecture (`ActivityLog`, `FinAnomaly`).

---

## Knowledge Base Navigation Matrix

| Topic # | Document Title | Primary Focus | Status |
| :--- | :--- | :--- | :--- |
| **01** | [01 Analytics Landscape](01-analytics-landscape.md) | Subsystem overview & master surface table | `IMPLEMENTED` |
| **02** | [02 Route Inventory](02-analytics-route-inventory.md) | Directory of all reporting & audit routes | `IMPLEMENTED` |
| **03** | [03 Dashboard Inventory](03-dashboard-inventory.md) | Executive, CFO, Sales & HR dashboards | `IMPLEMENTED` |
| **04** | [04 KPI Registry](04-kpi-registry.md) | Master registry of system KPIs (`KPI-001`+) | `IMPLEMENTED` |
| **05** | [05 KPI Formulas](05-kpi-formulas.md) | Mathematical formulas & source code logic | `IMPLEMENTED` |
| **06** | [06 Date & Time Logic](06-date-range-and-time-logic.md) | UTC vs. IST normalization & Indian FY logic | `IMPLEMENTED` |
| **07** | [07 Analytics Scoping](07-analytics-scoping.md) | Multi-property, venue & role scoping rules | `IMPLEMENTED` |
| **08** | [08 Sales Analytics](08-sales-analytics.md) | Pipeline velocity, conversion & sales SLA | `IMPLEMENTED` |
| **09** | [09 Lead Analytics](09-lead-analytics.md) | Speed to lead, SLA compliance & re-engagement | `IMPLEMENTED` |
| **10** | [10 Marketing Analytics](10-marketing-analytics.md) | Closed-loop attribution, CPL, CAC & ROAS | `IMPLEMENTED` |
| **11** | [11 Booking Analytics](11-booking-analytics.md) | Venue utilization, ABV & lead time | `IMPLEMENTED` |
| **12** | [12 Operations Analytics](12-operations-analytics.md) | BEO readiness SLA & event incidents | `IMPLEMENTED` |
| **13** | [13 Kitchen Analytics](13-kitchen-inventory-analytics.md) | Food cost ratio & inventory valuation | `IMPLEMENTED` |
| **14** | [14 Vendor Analytics](14-vendor-procurement-analytics.md) | Procurement spend & vendor performance | `IMPLEMENTED` |
| **15** | [15 Finance Analytics](15-finance-analytics.md) | Real-time P&L, Balance Sheet & Cash Flow | `IMPLEMENTED` |
| **16** | [16 Financial Reports](16-financial-reports.md) | Tally Prime XML export & GST reporting | `IMPLEMENTED` |
| **17** | [17 HR Analytics](17-hr-analytics.md) | Active headcount, attrition % & tenure | `IMPLEMENTED` |
| **18** | [18 Attendance Analytics](18-attendance-analytics.md) | Monthly muster roll & late/early counts | `IMPLEMENTED` |
| **19** | [19 Payroll Analytics](19-payroll-analytics.md) | Gross vs. Net payroll, PF, ESI, PT, TDS | `IMPLEMENTED` |
| **20** | [20 Recruitment Analytics](20-recruitment-analytics.md) | Candidate funnel & time to fill | `IMPLEMENTED` |
| **21** | [21 BD Analytics](21-business-development-analytics.md) | Property pipeline & capex variance | `IMPLEMENTED` |
| **22** | [22 Portal Analytics](22-portal-analytics.md) | Client quote views & vendor bid rates | `IMPLEMENTED` |
| **23** | [23 Communication Analytics](23-communication-analytics.md) | WhatsApp delivery & email open tracking | `IMPLEMENTED` |
| **24** | [24 Audit Architecture](24-audit-architecture.md) | `ActivityLog` model & audit logging design | `IMPLEMENTED` |
| **25** | [25 Audit Event Inventory](25-audit-event-inventory.md) | Master table of audited system actions | `IMPLEMENTED` |
| **26** | [26 Financial Audit](26-financial-audit.md) | Double-entry GL integrity & period locking | `IMPLEMENTED` |
| **27** | [27 HR Payroll Audit](27-hr-payroll-audit.md) | Payroll run approval lock & salary logs | `IMPLEMENTED` |
| **28** | [28 Security Audit](28-security-audit.md) | Failed login, 2FA & permission audits | `IMPLEMENTED` |
| **29** | [29 Portal Audit](29-portal-audit.md) | Quote view logs & e-signature IP logs | `IMPLEMENTED` |
| **30** | [30 Anomaly Detection](30-anomaly-detection.md) | Automated discount, payment & expense alerts| `IMPLEMENTED` |
| **31** | [31 Approval Analytics](31-approval-analytics.md) | Approval aging & SLA turnaround | `IMPLEMENTED` |
| **32** | [32 Report Exports](32-report-exports.md) | PDF, XLSX, CSV & Tally XML export engine | `IMPLEMENTED` |
| **33** | [33 Scheduled Reporting](33-scheduled-reporting.md) | Daily operations & HR reminder digests | `IMPLEMENTED` |
| **34** | [34 Analytics Automation](34-analytics-automation.md) | Daily attribution & yield cron rollups | `IMPLEMENTED` |
| **35** | [35 Data Freshness](35-data-freshness.md) | Real-time queries vs. cron aggregations | `IMPLEMENTED` |
| **36** | [36 Data Quality](36-data-quality-and-reconciliation.md) | GL reconciliation & lead touch repair | `IMPLEMENTED` |
| **37** | [37 Analytics Access Control](37-analytics-access-control.md) | RBAC permissions matrix for reports | `IMPLEMENTED` |
| **38** | [38 Audit Security](38-audit-security.md) | Immutability & actor traceability audit | `IMPLEMENTED` |
| **39** | [39 Audit Retention](39-audit-retention.md) | Purge cron & log retention policies | `IMPLEMENTED` |
| **40** | [40 Observability](40-observability.md) | Sentry, `CronRunLog` & system health APIs | `IMPLEMENTED` |
| **41** | [41 Integration Monitoring](41-integration-monitoring.md) | Razorpay, WhatsApp & Tally status logs | `IMPLEMENTED` |
| **42** | [42 Reporting APIs](42-reporting-apis.md) | Inventory of reporting API handlers | `IMPLEMENTED` |
| **43** | [43 Server Actions](43-reporting-server-actions.md) | Inventory of reporting Server Actions | `IMPLEMENTED` |
| **44** | [44 Data Models](44-analytics-audit-data-models.md) | Prisma schema definitions for analytics | `IMPLEMENTED` |
| **45** | [45 Aggregation Architecture](45-aggregation-and-snapshots.md) | Relational queries & aggregate tables | `IMPLEMENTED` |
| **46** | [46 Analytics Performance](46-analytics-performance.md) | Query indexes & waterfall prevention | `IMPLEMENTED` |
| **47** | [47 Test Matrix](47-analytics-audit-test-matrix.md) | QA and audit test specifications | `IMPLEMENTED` |
| **48** | [48 Manual Verification](48-manual-verification.md) | Operator testing steps & expected results | `IMPLEMENTED` |
| **49** | [49 Brief vs. Code](49-brief-vs-code.md) | Codebase vs. Project Brief comparison | `IMPLEMENTED` |
| **50** | [50 Feature Status](50-feature-status.md) | Implementation status matrix | `IMPLEMENTED` |
| **51** | [51 Feature Index](51-feature-index.md) | Master index of analytics features (`ANA-001`+)| `IMPLEMENTED` |
| **52** | [52 Requirement Traceability](52-requirement-traceability.md) | Mapping business rules to code files | `IMPLEMENTED` |
| **53** | [53 KPI Traceability](53-kpi-traceability.md) | Master KPI source traceability table | `IMPLEMENTED` |
| **54** | [54 Audit Traceability](54-audit-traceability.md) | Master audit event traceability table | `IMPLEMENTED` |
| **55** | [55 Capability Matrix](55-analytics-capability-matrix.md) | Cross-domain analytics capability matrix | `IMPLEMENTED` |
| **56** | [56 Audit Capability Matrix](56-audit-capability-matrix.md) | Cross-domain audit capability matrix | `IMPLEMENTED` |
| **57** | [57 Executive Data Flows](57-executive-analytics-data-flow.md) | Mermaid sequence & data flow diagrams | `IMPLEMENTED` |
| **58** | [Completion Report](COMPLETION-REPORT.md) | Official Chunk 23 audit summary | `COMPLETE` |
