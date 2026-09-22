# Phase 30: Master Performance Map

## Performance-Sensitive Operations
1. **Executive Dashboard Aggregations**: Queries aggregating revenue, bookings, and lead stats across multiple tables. Use database indexes on `createdAt`, `status`, and `venueId`.
2. **Monthly Payroll Batch Processing**: Iterating over all active employees to calculate LOP and generate payslips. Run in serverless background tasks using Prisma batch operations.
3. **BEO PDF Generation**: Dynamic React-pdf compilation for heavy BEO files. Offloaded to background job queues.
4. **General Ledger Balance Calculation**: Summing thousands of `FinJournalLine` entries. Indexed by `accountId` and `postedAt`.
