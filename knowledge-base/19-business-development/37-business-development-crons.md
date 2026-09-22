# 37 BD Crons

`CODE VERIFIED`

- `GET /api/cron/acq-sla` — Daily SLA escalation check for BD deals exceeding target days in stage (`src/app/api/cron/acq-sla/route.ts`).
- `POST /api/cron/contract-reminders` — Contract expiration alert check.
