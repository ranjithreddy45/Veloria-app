# 14 - Operation Vendor Assignment

---

## ⚙️ Operational Dispatch (`prisma.operationVendorAssignment`)

For event-day operations execution, `OperationVendorAssignment` connects an `EventOperation` to a `BookingVendor`:

| Field Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | `String` | `@id @default(cuid())` | Assignment ID |
| `operationId` | `String` | `@relation(EventOperation)` | Operational blueprint ID |
| `bookingVendorId` | `String` | `@relation(BookingVendor)` | Commercial assignment link |
| `role` | `String?` | Optional | On-site execution role |
| `cost` | `Decimal?` | `@db.Decimal(12, 2)` | Actual assigned cost |
| `setupTime` | `DateTime?` | Optional | Required on-site setup start time |
| `teardownTime` | `DateTime?` | Optional | Required teardown completion time |
| `status` | `VendorAssignmentStatus` | `@default(PENDING)` | `PENDING`, `CONFIRMED`, `COMPLETED` |
