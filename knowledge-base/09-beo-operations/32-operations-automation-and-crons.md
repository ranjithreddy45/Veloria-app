# 32 - Operations Automation & Cron Jobs

---

## ⏰ Automated Cron Census

| Cron Endpoint | Schedule | Purpose & Logic | Side Effects |
|---|---|---|---|
| `/api/cron/readiness-watchdog` | Every 2 Hours | Checks readiness for events within 48h | Triggers WhatsApp warning if score < 100% |
| `/api/cron/vendor-reminders` | Daily @ 08:00 AM | Reminds vendors of pending work order signatures | Sends WhatsApp work order links |
| `/api/cron/event-briefings` | Daily @ 06:00 AM | Dispatches morning event briefs | Sends daily event overview to banquet staff |
