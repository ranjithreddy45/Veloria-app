# 06 Campaign Lifecycle

`CODE VERIFIED`

- Email Campaign (`Campaign`): Created as `DRAFT`. Scheduled via `scheduledAt`. When `sendCampaign()` is invoked, transitions to `SENDING` -> `SENT`. Updates tracking counters `totalSent`, `totalOpened`, `totalClicked` as engagement events arrive.
- Marketing Campaign (`MarketingCampaign`): Created with `isActive = true`. Tracked continuously against arriving `LeadAttribution` records. Closed by setting `isActive = false` or reaching `endDate`.
