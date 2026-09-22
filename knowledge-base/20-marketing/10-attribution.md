# 10 Attribution and Tracking

`CODE VERIFIED`

The closed-loop attribution system is implemented in `src/lib/attribution.ts` and `LeadAttribution` model:
- **Captured Parameters**: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `referrerUrl`, `landingUrl`.
- **Click Identifiers**: `gclid` (Google Click ID), `gbraid`/`wbraid` (iOS Privacy Click IDs), `fbclid` (Facebook Click ID), `clientId` (GA Client ID).
- **Google Ads ValueTrack**: `gadsCampaignId`, `gadsAdgroupId`, `gadsCreativeId`, `gadsKeyword`, `gadsMatchType`, `gadsNetwork`, `gadsDevice`.
- **Campaign Resolution**: Matches `utm_campaign` or `gadsCampaignId` against `MarketingCampaign.utmCampaign` to set `campaignId`.
