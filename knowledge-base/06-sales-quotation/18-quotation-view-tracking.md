# Quote Radar View Telemetry & Dwell-Time Tracking

## Overview

Quote Radar (`QuoteView` model & `src/actions/public-quote-radar.actions.ts`) provides real-time sales telemetry when clients open proposal links.

---

## Captured Telemetry Attributes

- `device`: Device type (`DESKTOP`, `MOBILE`, `TABLET`).
- `durationMs`: Client dwell time on the proposal page in milliseconds.
- `ipHash`: Anonymized IP hash for unique visitor deduplication.
- `referrer`: Traffic source HTTP referrer.
- **Radar Panel**: Sales executives view live view activity in `/quotations` (`quote-radar-panel.tsx`).
