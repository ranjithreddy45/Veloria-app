# 05 KPI Formula Audit & Source Code Traceability

`CODE VERIFIED`

## Detailed KPI Mathematical Traceability

### 1. Closed-Loop Marketing ROAS (`src/actions/attribution-analytics.actions.ts`)
```typescript
// Formula: ROAS = Total Attributed Booked Revenue / Campaign Spend
export async function calculateCampaignRoas(campaignId: string) {
  const campaign = await prisma.marketingCampaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign || campaign.spend === 0) return 0;

  const attributions = await prisma.leadAttribution.findMany({
    where: { campaignId },
    include: { lead: { include: { bookings: true } } },
  });

  let totalAttributedRevenue = 0;
  for (const attr of attributions) {
    for (const booking of attr.lead.bookings) {
      if (booking.status === "CONFIRMED" || booking.status === "COMPLETED") {
        totalAttributedRevenue += booking.totalAmount;
      }
    }
  }

  return totalAttributedRevenue / campaign.spend;
}
```

### 2. Monthly Attendance Rate Formula (`src/actions/hr-report-attendance.actions.ts`)
- **Numerator**: Total `PRESENT` + (`HALF_DAY` * 0.5) records for the month.
- **Denominator**: Total official working calendar days in month (excluding official holidays).
- **Timezone**: Dates normalized to IST (`Asia/Kolkata`) prior to calculation.
