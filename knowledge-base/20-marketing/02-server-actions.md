# 02 Server Actions Inventory

`CODE VERIFIED`

## 1. `src/actions/marketing-campaign.actions.ts` (Marketing Spend Ledger)
- `getMarketingCampaigns(params)`: Fetch `MarketingCampaign` records. (Permission: `marketing:read`)
- `getMarketingCampaignById(id)`: Fetch single campaign. (Permission: `marketing:read`)
- `createMarketingCampaign(data)`: Create `MarketingCampaign` spend record. (Permission: `marketing:manage`)
- `updateMarketingCampaign(id, data)`: Update campaign details/spend. (Permission: `marketing:manage`)
- `updateMarketingCampaignSpend(id, data)`: Add spend entry to `spendToDate`. (Permission: `marketing:manage`)

## 2. `src/actions/campaign.actions.ts` (Email Campaigns)
- `getCampaigns()`: Fetch email `Campaign` records. (Permission: `campaigns:read`)
- `getCampaignById(id)`: Fetch email campaign with stats. (Permission: `campaigns:read`)
- `createCampaign(data)`: Create email campaign draft. (Permission: `campaigns:write`)
- `updateCampaign(id, data)`: Update email campaign. (Permission: `campaigns:write`)
- `sendCampaign(id)`: Send/Schedule email blast via Resend. (Permission: `campaigns:send`)

## 3. `src/actions/marketing-report.actions.ts` & `attribution-analytics.actions.ts`
- `getMarketingAttribution()`: Group leads by campaign, calculate lead count, qualified count, won count, total booking value, average booking value, and qualification rate. (Permission: `leads:read`)
- `getAttributionAnalytics(params)`: Multi-channel ROI/CAC/ROAS rollup report. (Permission: `marketing:read`)

## 4. `src/actions/public-referral.actions.ts`
- `getReferralPartnerByCode(code)`: Public resolution of partner code.
- `submitPublicReferral(code, input)`: Public referral submission with honeypot and rate limiting.

## 5. `src/actions/webform.actions.ts`
- `getWebforms()`, `createWebform()`, `updateWebform()`, `submitWebform()`.

## 6. `src/actions/email-template.actions.ts` & `email-tracking.actions.ts`
- `getEmailTemplates()`, `createEmailTemplate()`, `trackEmailOpen()`, `trackEmailClick()`.
