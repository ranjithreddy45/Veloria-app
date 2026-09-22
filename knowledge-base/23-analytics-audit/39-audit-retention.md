# 39 Audit Log Retention & Archival Policies

`CODE VERIFIED`

## Log Retention Engine

- Cron `/api/cron/trash-purge` purges soft-deleted records older than 30 days.
- Activity logs (`ActivityLog`) are retained indefinitely in PostgreSQL unless pruned via database maintenance scripts.
