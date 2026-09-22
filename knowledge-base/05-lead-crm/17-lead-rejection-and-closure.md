# Lead Rejection & Closure

## Overview

Managing lost, junked, or rejected inquiries.

---

## Rejection Process

1. **User Action**: Executive marks lead status as `LOST` or quality as Junk.
2. **Mandatory Field**: `Lead.lostReason` must be specified (e.g., "Competitor venue selected", "Date unavailable", "Over budget").
3. **Winback & Cooling Engine**: Lost leads enter the cooling sweep cron (`/api/cron/cooling-lead-catch/route.ts`), making them eligible for automated re-engagement after 90 days.
