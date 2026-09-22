# 08 Lead Acquisition

`CODE VERIFIED`

All marketing lead acquisition routes converge into `captureLeadFromExternal()` in `src/lib/lead-capture.ts`:
1. **Landing Pages**: `/api/landing-lead` accepts public form inputs.
2. **Dynamic Webforms**: `/api/webforms/[slug]` accepts custom embedded webforms.
3. **Google Ads Webhook**: `/api/webhooks/google-ads` parses ValueTrack parameters (`gclid`, `gadsCampaignId`, `gadsAdgroupId`).
4. **Push API**: `/api/v1/push/leads` accepts structured external lead payloads.
5. **Referral Portal**: `/refer/[code]` submits referrals via `submitPublicReferral()`.
