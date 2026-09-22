# 11 Booking & Venue Utilization Analytics

`CODE VERIFIED`

## Venue Occupancy & Revenue Analytics (`src/actions/analytics.actions.ts`)

- **Venue Utilization %**: `(Booked Days in Period / Total Operating Days in Period) * 100`.
- **Peak Date Demand**: Tracks hot dates and demand signals (`VenueDemandSignal`) to trigger yield pricing adjustments.
- **Average Booking Value (ABV)**: Total revenue divided by total confirmed bookings.
- **Lead Time**: Days between booking confirmation date and actual event date.
