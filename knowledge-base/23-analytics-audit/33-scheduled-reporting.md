# 33 Scheduled Reporting & Email Digests

`CODE VERIFIED`

## Automated Scheduled Reports

- **Daily Operations Briefing**: Cron `/api/cron/event-briefings` sends daily summary of upcoming events to management.
- **HR Reminders Digest**: Cron `/api/cron/hr-reminders` emails pending leave & attendance regularization digests to department heads.
