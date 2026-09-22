# 08 Sales & Pipeline Analytics

`CODE VERIFIED`

## Sales Funnel & Pipeline Velocity (`src/actions/sales-analytics.actions.ts`)

Sales analytics track lead conversion rates across stages (`NEW` -> `QUALIFIED` -> `SITE_VISIT` -> `QUOTATION_SENT` -> `NEGOTIATION` -> `WON` -> `BOOKING`).

### Key Sales Metrics
- **Pipeline Value**: Sum of estimated budget for open leads & pending quotations.
- **Sales Velocity**: Calculated as `(Number of Deals * Average Deal Value * Win Rate %) / Average Sales Cycle Length (Days)`.
- **Quote Conversion %**: Ratio of accepted quotations (`SalesQuotation.status = ACCEPTED`) to total issued quotations.
- **Salesperson Performance**: Tracks deal volume, revenue closed, and average response time per sales executive.
