# DASHBOARD DATA OWNERSHIP MAP

## 1. Comprehensive Data Mapping

This map traces every dashboard UI element to its backend database model.

| Dashboard Widget | Server Action | Business Service | Prisma Model(s) | Aggregated Fields |
|---|---|---|---|---|
| **Cash Collected KPI** | `getHomeView()` | `cashCollected()` | `Payment` | `_sum(amount)` where `status = COMPLETED` |
| **Booked Revenue KPI** | `getHomeView()` | `bookedValue()` | `Booking` | `_sum(totalAmount)` where `status = CONFIRMED` |
| **SLA Breaches KPI** | `getHomeView()` | `getHomeFacts()` | `Lead` | `count()` where `firstResponseBreachedAt != null` |
| **Receivables KPI** | `getHomeView()` | `getHomeFacts()` | `Invoice` | `_sum(balanceDue)` where `status = OVERDUE` |
| **Today's Events** | `getHomeView()` | `getHomeFacts()` | `Booking` | `findMany()` by `eventStartDate` |
| **Live Activity** | `/api/activity` | `AuditLogger` | `ActivityLog` | `findMany()` ordered by `createdAt desc` |
