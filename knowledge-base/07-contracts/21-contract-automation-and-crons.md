# Contract Automation & Cron Routines

## Overview

Background cron tasks handling unsigned contract reminders (`/api/cron/contract-reminders/route.ts` & `src/lib/acq/contract-reminders.ts`).

---

## Cron Job Inventory

- **`/api/cron/contract-reminders/route.ts`**: Runs on a daily schedule; queries unsigned contracts (`SignatureRequestStatus IN [SENT, VIEWED]`) approaching `expiresAt` and dispatches reminder nudges.
