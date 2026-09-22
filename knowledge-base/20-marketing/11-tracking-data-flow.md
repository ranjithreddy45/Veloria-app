# 11 Tracking Data Flow

`CODE VERIFIED`

```
Ad Click (with GCLID / UTMs)
  |
  v
Landing Page Form Submission
  |
  v
captureLeadFromExternal()
  |
  +---> Creates Lead
  +---> Creates LeadAttribution (1:1 with Lead)
  +---> Matches MarketingCampaign
  |
  v [Sales Closed Deal]
Lead Status -> WON -> Booking Created
  |
  v
Attribution Rollup Cron (/api/cron/attribution-rollup)
  |
  +---> Updates LeadAttribution.bookedRevenue = Booking.totalAmount
  +---> Aggregates Total Revenue per MarketingCampaign
  +---> Calculates ROAS = (Booked Revenue / Campaign Spend)
```
