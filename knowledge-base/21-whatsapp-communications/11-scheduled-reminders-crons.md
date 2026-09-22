# 11 Scheduled Reminders & Crons

`CODE VERIFIED`

- `/api/cron/payment-reminders` — Sends WhatsApp & email alerts for installment due dates.
- `/api/cron/site-visit-reminders` — Reminds leads of upcoming property site visits.
- `/api/cron/contract-reminders` — Alerts vendors/owners of contract expirations.
- `/api/cron/guest-reminders` — Sends RSVP nudges to event guests (`save_the_date`, `final_countdown`, `tomorrow_reminder`).
- `/api/cron/whatsapp-inbound-prune` — Cleans up historical `WhatsAppInboundEvent` raw logs older than retention policy.
