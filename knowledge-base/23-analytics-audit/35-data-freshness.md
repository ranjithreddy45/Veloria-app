# 35 Data Freshness & Caching Architecture

`CODE VERIFIED`

## Data Freshness Classification

- **Real-Time (`REQUEST_TIME`)**: Executive dashboards, financial AR/AP, live booking calendars. Queries PostgreSQL directly on request.
- **Cron Aggregated (`CRON_AGGREGATED`)**: Marketing attribution ROAS, venue demand signals, performance leaderboards. Refreshed hourly/daily.
- **Static Snapshots (`SNAPSHOT`)**: Closed payroll runs (`HrPayrollRun`), finalized financial periods (`FinPeriod`).
