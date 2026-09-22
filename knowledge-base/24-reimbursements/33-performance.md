# 33 Performance, Concurrency & Query Optimization

`CODE VERIFIED`

## Query Optimization Rules

- Prisma indexes on `HrReimbursementClaim(employeeId, status)` and `HrClaimAttachment(claimId)` ensure sub-50ms query execution times.
