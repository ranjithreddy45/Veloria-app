# DASHBOARD LOADING, EMPTY & ERROR STATES

## 1. UI State Inventory

| State ID | State Name | Component Manifestation | Visual Representation |
|---|---|---|---|
| **STATE-0501** | `LOADING` | Next.js `loading.tsx` / Skeleton Loader | Pulsing skeleton cards for KPIs & feed items |
| **STATE-0502** | `DEGRADED` | Warning Banner in `DashboardPage` | Amber notification strip: `"Some figures could not be loaded..."` |
| **STATE-0503** | `EMPTY_ATTENTION` | `AttentionFeed` | `"You're all caught up! No urgent items requiring attention."` |
| **STATE-0504** | `EMPTY_ACTIVITY` | `ActivityFeed` | `"No recent activity to show right now."` |
| **STATE-0505** | `UNAUTHORIZED` | `DashboardPage` guard fallback | `"The team home is not available for this account."` |
