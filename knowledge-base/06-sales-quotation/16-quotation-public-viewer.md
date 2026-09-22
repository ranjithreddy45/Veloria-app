# Public Quotation Viewer Portal

## Overview

The Public Quote Viewer (`/q/[token]`) allows clients to view proposal details, compare pricing tiers, track slot availability, and pay booking deposits.

---

## Key Features & Components (`src/app/(public)/q/[token]/_components/`)

- `public-quote-view.tsx`: Client-facing interactive proposal dashboard.
- `quote-radar-beacon.tsx`: Invisible telemetry component sending dwell-time signals to Quote Radar.
- `slot-scarcity.tsx`: Real-time banner warning of limited venue date availability.
- `one-tap-pay.tsx`: Razorpay instant deposit payment widget.
