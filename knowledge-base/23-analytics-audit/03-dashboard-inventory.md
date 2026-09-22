# 03 Dashboard Inventory & Audience Specifications

`CODE VERIFIED`

## Master Dashboard Inventory

| Dashboard | Target Audience | Primary KPIs | Source Server Action | Freshness |
| :--- | :--- | :--- | :--- | :--- |
| **CFO Command Center** | CFO, Finance Head | Net Revenue, AR Outstanding, AP Pending, Operating Margin | `getFinanceCommandCenterData()` | Real-Time |
| **Executive Analytics** | CEO, General Manager | Booked Revenue, Conversion Rate, Occupancy, Average Order Value | `getExecutiveAnalytics()` | Real-Time |
| **Sales Velocity Hub** | Sales Head, Executives | Pipeline Value, Lead SLA Compliance, Win Rate, Quote Conversion | `getSalesAnalyticsData()` | Real-Time |
| **Marketing Attribution** | Marketing Manager | Spend, CPL, CAC, Booked Revenue, ROAS per Channel | `getAttributionAnalytics()` | Cron Rollup (Daily) |
| **People Analytics** | HR Director | Headcount, Monthly Attrition %, Absenteeism %, Total Payroll Cost | `getHrAnalyticsData()` | Real-Time |
| **Event Profitability** | Event Ops / Finance | Revenue per Event, Direct Costs, Margin %, Net Profit per Booking | `getEventProfitabilityReport()` | Request-Time |
| **System Anomaly Monitor**| Auditor, Compliance | Flagged GL Transactions, Duplicate Invoices, Unusual Discounts | `getSystemAnomalies()` | Cron + Real-Time |
