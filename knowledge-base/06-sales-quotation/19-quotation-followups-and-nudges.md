# Quotation Follow-Ups & Silent Nudge Engine

## Overview

Automated quotation follow-ups (`src/lib/quote-radar/silent-nudge.ts` & `src/lib/sales/quote-nudge-cron.ts`) nudge clients who have opened proposals but not yet accepted.

---

## Nudge Mechanics

- **Silent Nudge Trigger**: When `QuoteView` records dwell time > 45 seconds without acceptance, `silentNudgeFiredAt` is populated.
- **Automated Cadence**: Enrolls lead into cadence automation and notifies assigned sales executive.
