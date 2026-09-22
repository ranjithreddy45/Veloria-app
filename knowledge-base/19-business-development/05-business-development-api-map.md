# 05 Business Development API Map

`CODE VERIFIED`

## Implemented API Endpoints & Crons
- `GET /api/cron/acq-sla`: SLA Escalation Cron — Scans `AcqDeal` records exceeding stage SLA thresholds and sends escalation alerts (`src/app/api/cron/acq-sla/route.ts`).
- `POST /api/cron/contract-reminders`: Contract Expiry Reminders — Scans expiring `AcqContract` records.
- All primary BD UI interactions utilize Server Actions directly.
