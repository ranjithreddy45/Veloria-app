# Lead Automation & Cron Routines

## Overview

Background scheduled tasks supporting lead engagement, SLA tracking, and winback routines.

---

## Registered Cron Routines (`src/app/api/cron/`)

1. **`/api/cron/cooling-lead-catch/route.ts`**: Sweeps inactive or lost leads older than 90 days and schedules cooling re-engagement campaigns.
2. **`/api/cron/lead-engagement-reconcile/route.ts`**: Reconciles touch counts (`touchCount`), update timestamps, and unresponded SLA flags.
3. **`/api/cron/winback-lost-lead/route.ts`**: Identifies past lost leads with upcoming seasonal event dates and triggers promotional winback offers.
