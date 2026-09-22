# Lead Sources & Ingestion Mechanics

## Overview

Veloria Grand ingests leads from 17 distinct sources via direct API integration, webhooks, website forms, and third-party push APIs.

---

## Supported Lead Sources (`LeadSource` Enum)

- `WEBSITE`: Official venue website contact & inquiry forms.
- `FACEBOOK_ADS`: Automated Meta Lead Ads webhook integration.
- `GOOGLE_ADS`: Google Ads webhook and landing page campaign parameters.
- `INSTAGRAM`: Instagram DM and ad lead capture.
- `WHATSAPP`: Inbound WhatsApp Business API chat initiation.
- `INDIAMART`, `JUSTDIAL`, `WEDMEGOOD`: Third-party aggregator portal leads.
- `WALK_IN`, `PHONE_INQUIRY`: Direct offline staff entry.
- `REFERRAL`, `PARTNER`, `EVENT`, `OTHER`.

---

## Ingestion Technical Pipelines

### 1. Facebook Lead Ads Webhook (`src/app/api/webhooks/facebook-leads/route.ts`)
- **Authentication**: Meta webhook verification token (`FB_VERIFY_TOKEN`).
- **Logic**: Receives leadgen payload, fetches lead data via Graph API, maps fields, creates `Contact` and `Lead` records.

### 2. Third-Party Push API (`src/app/api/v1/push/leads/route.ts`)
- **Authentication**: Header API Key validated against `ApiKey` model (`src/lib/push-api/leads/endpoint.ts`).
- **Concurrency Guard**: Atomic Redis/DB lock (`ingest-lock.ts`) prevents duplicate ingestion of identical external lead IDs.

### 3. Landing Page API (`src/app/api/landing-lead/route.ts`)
- **Logic**: Form submission handler with automated enrichment (`src/lib/landing-lead-enrich.ts`).
