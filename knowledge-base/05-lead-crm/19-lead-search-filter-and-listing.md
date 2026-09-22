# Lead Search, Filtering & Listing Engine

## Overview

The lead listing dashboard (`/leads`) features high-performance searching, multi-parameter filtering, saved views, and custom views.

---

## Filtering Capabilities (`src/lib/crm/lead-filters.ts`)

- **Text Search**: Matches lead title, contact name, phone, email.
- **Status Filter**: Multi-select filter on `LeadStatus` enum (`NEW`, `QUALIFIED`, etc.).
- **Source Filter**: Filter by `LeadSource` (`FACEBOOK_ADS`, `WEBSITE`, `WHATSAPP`).
- **Score & Budget Filters**: Range sliders for `score`, `estimatedValue`, and `perPlateBudget`.
- **Date Filters**: Filter by `createdAt`, `eventDate`, or `followUpDate`.
- **Custom Views**: Saved filter configurations (`SavedView` model) rendered in `leads-views.tsx`.
