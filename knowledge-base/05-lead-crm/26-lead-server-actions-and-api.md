# Lead Server Actions & API Inventory

## Overview

Complete inventory of backend Server Actions and API endpoints powering Lead CRM.

---

## Server Actions (`src/actions/`)

- `createLead()` (`lead.actions.ts`): Creates a new lead and upserts contact details.
- `updateLeadStatus()` (`lead.actions.ts`): Updates status and logs activity.
- `assignLeadOwner()` (`lead.actions.ts`): Reassigns owner and dispatches email.
- `updateLeadQuality()` (`lead-quality.actions.ts`): Updates lead quality classification.
- `runCoolingSweep()` (`cooling-lead.actions.ts`): Triggers cooling re-engagement.
- `importLeadsBatch()` (`lead-import.actions.ts`): Processes CSV lead import batches.

---

## API Handlers (`src/app/api/`)

- `POST /api/leads/capture`: Public web widget lead capture handler.
- `POST /api/landing-lead`: Website landing page inquiry endpoint.
- `POST /api/v1/push/leads`: Secure push API for external ad aggregators.
- `POST /api/webhooks/facebook-leads`: Meta Lead Ads webhook listener.
