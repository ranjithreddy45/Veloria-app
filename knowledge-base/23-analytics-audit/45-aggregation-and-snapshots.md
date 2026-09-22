# 45 Aggregation, Rollups & Snapshot Architecture

`CODE VERIFIED`

## Aggregation Architecture

Analytics calculations query the primary PostgreSQL database directly using Prisma relational joins and aggregations (`_sum`, `_avg`, `_count`). Scheduled cron rollups write summary aggregates into `MarketingCampaign` and `VenueDemandSignal`.
