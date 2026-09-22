# 11 Leave Ledger & Transaction Tracking

## Audit & Balance Modifications

Leave balance mutations are recorded atomically inside Prisma transactions within `applyLeave`, `decideLeave`, and `cancelLeave`.
