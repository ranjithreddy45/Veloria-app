# 01 Route Inventory

`CODE VERIFIED`

## Internal Marketing & Campaign Routes
- `/marketing` — Main Marketing & Attribution Dashboard (`src/app/(dashboard)/marketing/page.tsx`)
- `/marketing/campaigns` — Marketing Spend & Channel Campaign Ledger (`src/app/(dashboard)/marketing/campaigns/page.tsx`)
- `/marketing/campaigns/new` — Create Marketing Campaign (`src/app/(dashboard)/marketing/campaigns/new/page.tsx`)
- `/marketing/campaigns/[campaignId]/edit` — Edit Marketing Campaign (`src/app/(dashboard)/marketing/campaigns/[campaignId]/edit/page.tsx`)
- `/campaigns` — Email Blast Campaign Board (`src/app/(dashboard)/campaigns/page.tsx`)
- `/campaigns/new` — Create Email Campaign (`src/app/(dashboard)/campaigns/new/page.tsx`)
- `/campaigns/[campaignId]` — View Email Campaign Stats (`src/app/(dashboard)/campaigns/[campaignId]/page.tsx`)
- `/campaigns/[campaignId]/edit` — Edit Email Campaign (`src/app/(dashboard)/campaigns/[campaignId]/edit/page.tsx`)
- `/reports/marketing-attribution` — Marketing Attribution Report (`src/app/(dashboard)/reports/marketing-attribution/page.tsx`)
- `/settings/integrations/website-form` — Webform Integration Settings (`src/app/(dashboard)/settings/integrations/website-form/page.tsx`)
- `/settings/integrations/lead-capture` — Meta/Facebook Lead Ads Settings (`src/app/(dashboard)/settings/integrations/lead-capture/_components/facebook-config.tsx`)
- `/settings/email-templates` — Email Templates Master (`src/app/(dashboard)/settings/email-templates/page.tsx`)

## Public Unauthenticated Intake Routes
- `/refer/[code]` — Public Referral Intake Landing Page (`src/app/(public)/refer/[code]/page.tsx`)
- `/form/[slug]` — Public Webform Intake Page (`src/app/(public)/form/[slug]/_components/public-form.tsx`)
- `/api/landing-lead` — Public Landing Page Lead Submission API (`src/app/api/landing-lead/route.ts`)
- `/api/webforms/[slug]` — Public Dynamic Webform Submission API (`src/app/api/webforms/[slug]/route.ts`)
- `/api/webhooks/google-ads` — Google Ads Webhook Endpoint (`src/app/api/webhooks/google-ads/route.ts`)
- `/api/v1/marketing/offline-conversions` — Offline Conversion Export API (`src/app/api/v1/marketing/offline-conversions/route.ts`)
- `/api/cron/attribution-rollup` — Scheduled Attribution Rollup Cron (`src/app/api/cron/attribution-rollup/route.ts`)
