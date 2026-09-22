# 37 - Crons & Automation

---

## ⏰ Automated Scheduled Jobs

| Cron Endpoint | Schedule | Purpose |
|---|---|---|
| `/api/cron/invoice-due` | Daily (07:00 AM) | Marks overdue invoices (`dueDate < today`) |
| `/api/cron/payment-reminders` | Daily (09:00 AM) | Sends WhatsApp/Email installment reminders |
