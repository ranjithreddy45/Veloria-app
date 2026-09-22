# CHUNK 01-13 — BACKGROUND JOBS & CRON ARCHITECTURE

- **Status**: `CODE VERIFIED` | `BRIEF DOCUMENTED`
- **Module**: System Architecture
- **Target Path**: `knowledge-base/01-system-architecture/13-background-jobs-cron-architecture.md`

---

## 📌 Cron Schedule Topology

The application contains **56 Cron Endpoints** located in `src/app/api/cron/`.

```
src/app/api/cron/
├── ai-scoring/                 # Hourly AI lead quality scoring
├── cooling-lead-catch/         # Daily stale lead re-engagement trigger
├── public-hold-expiry/         # 15m slot hold expiration release
├── quote-nudge/                # Daily unviewed quotation reminder
├── handover-sla/               # 30m sales-to-ops handover SLA check
├── readiness-watchdog/         # 2h pre-event BEO checklist verification
├── invoice-due/                # Daily payment milestone due reminders
├── hr-reminders/               # Daily 09:00 AM attendance punch reminders
├── review-requests/            # 24h post-event CSAT & Google review request
└── trash-purge/                # Weekly soft-delete record purge
```

---

## ⚠️ Configuration Discrepancy (Brief Section 06 / B2)

- **Codebase Implementation**: The codebase defines 56 fine-grained cron routes designed for multi-lane execution (fast lane every 15m, frequent lane hourly, daily batch lane).
- **Deployment Configuration**: Hosting configs (`vercel.json` or basic crontab) often only execute daily batch runs at 02:00 UTC.
- **Production Impact**: Time-critical automations (public slot hold release every 15m, handover SLA escalations every 30m) require registering multi-cadence cron triggers on the hosting server or PM2 crontab.
