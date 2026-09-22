# 30 Anomaly & Fraud Detection Engine

`CODE VERIFIED`

## Automated Anomaly Engine (`src/actions/anomaly.actions.ts` & `finance-anomaly.actions.ts`)

Ran via cron `/api/cron/anomaly-detection`:

1. **Unusual Discount Alert**: Flags quotations/invoices where line item discount exceeds 25% of standard rate card.
2. **Duplicate Payment Detection**: Flags payments sharing identical amount, reference number, and client within a 24-hour window.
3. **Outlier Expense Detection**: Flags vendor bills exceeding 2 standard deviations above historical category average.
4. **Attendance Geo-Fencing Breach**: Flags check-ins occurring outside designated venue geofence coordinates (`AttendanceSite`).
5. **Persistence**: Anomalies stored in `FinAnomaly` and `AnomalyAlert` tables for auditor review.
