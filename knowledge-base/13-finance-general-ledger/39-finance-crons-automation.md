# 39 Finance Automation & Cron Jobs

## Automated Scheduled Services

1. **Referral Payouts Cron**: `/api/cron/referral-payouts` (Executes recurring referral rewards).
2. **Invoice Due Checker**: Background task alerting on overdue AR.
3. **Anomaly Detector**: Scans `FinJournalEntry` for unusual transaction sizes or unmapped accounts.
