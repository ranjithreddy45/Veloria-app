# 31 - Payment Reminders & Cron Sweeps

---

## ⏰ Automated Cron Schedules

| Cron Route | File Path | Schedule | Purpose |
|---|---|---|---|
| `/api/cron/invoice-due` | `src/app/api/cron/invoice-due/route.ts` | Daily (07:00 AM) | Marks past-due invoices as `OVERDUE` |
| `/api/cron/payment-reminders` | `src/app/api/cron/payment-reminders/route.ts` | Daily (09:00 AM) | Dispatches upcoming installment reminders |
