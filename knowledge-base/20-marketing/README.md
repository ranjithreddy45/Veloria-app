# Module 20: Marketing

`CODE VERIFIED`

## Module Purpose
The Marketing module manages multi-channel customer acquisition for Veloria Grand—from digital campaign spend tracking (`MarketingCampaign`), email blast execution (`Campaign`), first-touch attribution capture (`LeadAttribution`), public referral portal management (`ReferralPartner`), through to automated closed-loop ROAS calculation linking advertising spend to downstream booking revenue.

---

## Technical & Architecture Summary

### Routes Discovered
- `/marketing` — Main Marketing & Attribution Dashboard
- `/marketing/campaigns` — Marketing Spend & Channel Campaign Ledger
- `/marketing/campaigns/new` — Create Marketing Campaign
- `/marketing/campaigns/[campaignId]/edit` — Edit Marketing Campaign
- `/campaigns` — Email Blast Campaign Board
- `/campaigns/new` — Create Email Campaign
- `/campaigns/[campaignId]` — View Email Campaign Stats
- `/campaigns/[campaignId]/edit` — Edit Email Campaign
- `/reports/marketing-attribution` — Marketing Attribution Report
- `/settings/integrations/website-form` — Webform Integration Settings
- `/settings/integrations/lead-capture` — Meta/Facebook Lead Ads Settings
- `/settings/email-templates` — Email Templates Master
- `/refer/[code]` — Public Referral Intake Landing Page
- `/form/[slug]` — Public Webform Intake Page
- `/api/landing-lead` — Public Landing Page Lead Submission API
- `/api/webforms/[slug]` — Public Dynamic Webform Submission API
- `/api/webhooks/google-ads` — Google Ads Webhook Endpoint
- `/api/v1/marketing/offline-conversions` — Offline Conversion Export API
- `/api/cron/attribution-rollup` — Scheduled Attribution Rollup Cron

### Server Actions Discovered
- `src/actions/marketing-campaign.actions.ts`: `getMarketingCampaigns`, `getMarketingCampaignById`, `createMarketingCampaign`, `updateMarketingCampaign`, `updateMarketingCampaignSpend`.
- `src/actions/campaign.actions.ts`: `getCampaigns`, `getCampaignById`, `createCampaign`, `updateCampaign`, `sendCampaign`.
- `src/actions/marketing-report.actions.ts` & `attribution-analytics.actions.ts`: `getMarketingAttribution`, `getAttributionAnalytics`.
- `src/actions/public-referral.actions.ts`: `getReferralPartnerByCode`, `submitPublicReferral`.
- `src/actions/webform.actions.ts`: `getWebforms`, `createWebform`, `submitWebform`.
- `src/actions/email-template.actions.ts` & `email-tracking.actions.ts`: `getEmailTemplates`, `createEmailTemplate`, `trackEmailOpen`, `trackEmailClick`.

### Prisma Models Discovered
- `MarketingCampaign`
- `LeadAttribution`
- `Campaign`
- `EmailTemplate`
- `EmailTrackingPixel` & `EmailTrackingEvent`
- `ReferralPartner`, `ReferralPortalSubmission`, `ReferralPayout`, `Referral`
- `Lead`, `Contact`, `Booking`

---

## Document Index
1. `01-route-inventory.md` — Route Inventory Across Admin & Public Intake
2. `02-server-actions.md` — Server Actions Inventory
3. `03-data-models.md` — Data Model Inventory & Schemas
4. `04-enums-and-state-machines.md` — Enums & State Machine Lifecycles
5. `05-campaign-management.md` — Two-Tier Campaign Architecture
6. `06-campaign-lifecycle.md` — Campaign State Machine & Execution
7. `07-marketing-channels.md` — Marketing Channels & Lead Sources
8. `08-lead-acquisition.md` — Central Lead Acquisition Engine
9. `09-marketing-to-crm-handoff.md` — Marketing to CRM Handoff Workflow
10. `10-attribution.md` — First-Touch Attribution & Click IDs
11. `11-tracking-data-flow.md` — Attribution Data Flow Diagram
12. `12-audiences-and-segments.md` — Recipient Filters & Dynamic Audiences
13. `13-content-management.md` — Creative Assets & Media Storage
14. `14-template-system.md` — Email Template Engine & Tokens
15. `15-email-marketing.md` — Email Blasts & Open/Click Tracking
16. `16-social-and-whatsapp-marketing.md` — Meta Lead Ads & WhatsApp Welcome
17. `17-promotions-and-offers.md` — Promotional Offers & Pricing Linkage
18. `18-referral-system.md` — Client & Partner Referral Portal
19. `19-marketing-analytics.md` — Marketing Attribution Analytics Report
20. `20-revenue-attribution-chain.md` — Closed-Loop ROAS Revenue Chain
21. `21-marketing-automation.md` — Cron Automation & External CRM Push
22. `22-webhooks.md` — Webhook Endpoints (Google Ads, Meta, Webforms)
23. `23-rbac-and-security.md` — RBAC Security & Public Form Protection
24. `24-audit-and-compliance.md` — Activity Logging & DPDP Consent Ledger
25. `25-integrations.md` — External Marketing Integrations Matrix
26. `26-configuration.md` — Environment Variables & Credentials
27. `27-failure-modes.md` — Failure Modes, Resiliency & Rate Limits
28. `28-data-flows.md` — Mermaid Architecture & Flow Diagrams

---

CHUNK 20 STATUS: COMPLETE
