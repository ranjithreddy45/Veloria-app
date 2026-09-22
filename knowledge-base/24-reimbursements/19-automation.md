# 19 Automation, Scheduled Tasks & Reminders

`CODE VERIFIED`

## Automated Scheduled Tasks

- **Pending Approval Digest**: Cron `/api/cron/hr-reminders` scans for claims sitting in `PENDING` or `PENDING_L2` status for >48 hours and emails pending digest to approvers.
