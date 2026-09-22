# 09 Lead CRM & SLA Analytics

`CODE VERIFIED`

## Lead Acquisition & Response SLA Metrics (`src/actions/speed-to-lead.actions.ts`)

- **Speed to Lead**: Difference between `Lead.createdAt` and `LeadFirstResponse.respondedAt`.
- **SLA Threshold**: Target first contact within 15 minutes. Leads exceeding 15 minutes trigger `LeadSlaEscalation`.
- **Source Performance**: Aggregates lead count and conversion rate by channel (`Meta Ads`, `Google Ads`, `Website Widget`, `Referral`, `Walk-in`).
- **Cooling & Winback Leads**: Tracks inactive leads flagged for re-engagement by cron (`/api/cron/cooling-lead-catch`).
