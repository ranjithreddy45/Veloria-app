# 42 - Vendor Procurement Automation & Crons

---

## ⏰ Scheduled Cron Jobs

| Cron Route | Source File | Schedule | Purpose |
|---|---|---|---|
| `/api/cron/vendor-reminders` | `src/app/api/cron/vendor-reminders/route.ts` | Daily (08:00 AM) | Sends WhatsApp setup reminders to vendors 24 hours prior to event setup |
