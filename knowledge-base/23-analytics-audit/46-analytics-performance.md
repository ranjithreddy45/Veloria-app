# 46 Performance, Heavy Queries & Bottlenecks

`CODE VERIFIED`

## Performance & Optimization Rules

- **Indexing**: High-volume queries on `ActivityLog.createdAt`, `FinJournalEntry.postingDate`, and `Lead.createdAt` are backed by database indexes.
- **Waterfall Prevention**: Server Actions combine parallel Prisma queries using `Promise.all()`.
