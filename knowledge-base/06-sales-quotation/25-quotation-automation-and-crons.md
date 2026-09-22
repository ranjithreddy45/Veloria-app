# Quotation Automation & Cron Routines

## Overview

Background cron tasks handling stale quotation nudges and winback routines.

---

## Cron Job Inventory

1. **`/api/cron/quote-nudge/route.ts`**: Runs hourly; checks viewed quotes untouched for > 24 hours and dispatches automated reminder nudges.
2. **`/api/cron/winback-abandoned-quote/route.ts`**: Identifies unaccepted quotes older than 14 days and triggers re-engagement offers.
