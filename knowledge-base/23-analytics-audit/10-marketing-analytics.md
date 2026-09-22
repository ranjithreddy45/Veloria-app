# 10 Marketing Attribution & CAC/ROAS Analytics

`CODE VERIFIED`

## Closed-Loop Attribution Model (`src/actions/attribution-analytics.actions.ts`)

- **First-Touch / Last-Touch Attribution**: Recorded in `LeadAttribution` (`utm_source`, `utm_medium`, `utm_campaign`, `gclid`).
- **Campaign Performance**: Links `MarketingCampaign.spend` with closed `Booking.totalAmount` via `LeadAttribution`.
- **ROAS Calculation**: `Booked Revenue / Campaign Spend`.
- **CAC Calculation**: `Campaign Spend / Attributed Bookings Count`.
- **Automated Rollup**: Daily cron `/api/cron/attribution-rollup` recalculates campaign aggregates and updates `MarketingCampaign.roi`.
