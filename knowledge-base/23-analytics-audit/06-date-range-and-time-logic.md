# 06 Date Range & Time Logic Architecture

`CODE VERIFIED`

## Date Handling Standards

1. **Timezone Normalization**:
   - PostgreSQL stores all timestamps in UTC (`DateTime`).
   - Server Actions convert UTC boundaries to IST (`Asia/Kolkata`, UTC+05:30) for daily, monthly, and fiscal year calculations.
   - Start of day is normalized to `00:00:00.000 IST` (which is `18:30:00.000 UTC` previous day).
   - End of day is normalized to `23:59:59.999 IST`.

2. **Indian Fiscal Year Logic**:
   - Fiscal Year runs from April 1st to March 31st (e.g. FY 2026-27 is `2026-04-01` to `2027-03-31`).
   - Financial report server actions (`src/actions/finance-profitability.actions.ts`) automatically resolve FY parameters when requested.
