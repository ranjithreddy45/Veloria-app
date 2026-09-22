# 44 Prisma Data Models for Analytics & Audit

`CODE VERIFIED`

## Key Data Schema Definitions

```prisma
model ActivityLog {
  id         String   @id @default(cuid())
  userId     String
  action     String
  entityType String
  entityId   String
  metadata   Json?
  createdAt  DateTime @default(now())
}

model FinAnomaly {
  id          String   @id @default(cuid())
  anomalyType String
  description String
  severity    String   @default("MEDIUM")
  isResolved  Boolean  @default(false)
  createdAt   DateTime @default(now())
}

model CronRunLog {
  id         String   @id @default(cuid())
  jobName    String
  status     String
  durationMs Int
  error      String?
  createdAt  DateTime @default(now())
}
```
