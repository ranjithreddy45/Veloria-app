# 24 Audit Architecture & Log Models

`CODE VERIFIED`

## Audit System Architecture

System events are recorded in dedicated audit log tables:

```
+-----------------------------------------------------------------------------------+
|                            SYSTEM AUDIT ARCHITECTURE                              |
+-----------------------------------------------------------------------------------+
       |                     |                    |                   |
       v                     v                    v                   v
+--------------+      +--------------+     +--------------+    +--------------------+
| ActivityLog  |      |ProjectAudit. |     | OpsAuditItem |    | CronRunLog         |
| User/System  |      | Property BD  |     | Event Ops    |    | Automated Jobs     |
+--------------+      +--------------+     +--------------+    +--------------------+
```

### Core Audit Fields (`ActivityLog` Model)
- `id`: Unique CUID primary key.
- `userId`: ID of acting user (or `SYSTEM` for automated background tasks).
- `action`: Event identifier (e.g. `BOOKING_CANCELLED`, `SALARY_MODIFIED`, `PAYMENT_RECEIVED`).
- `entityType`: Target domain model (e.g. `Booking`, `Invoice`, `Employee`).
- `entityId`: Foreign key of affected record.
- `metadata`: JSON object containing old values, new values, IP address, and User-Agent.
- `createdAt`: Immutable UTC timestamp.
