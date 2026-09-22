# 36 Data Quality & System Reconciliation

`CODE VERIFIED`

## Reconciliation Engines

- **General Ledger Reconciliation**: Cron `/api/cron/gl-reconcile` checks for unbalanced journal entries or unposted invoices.
- **Lead Engagement Reconciliation**: Cron `/api/cron/lead-engagement-reconcile` repairs orphaned touchpoints.
