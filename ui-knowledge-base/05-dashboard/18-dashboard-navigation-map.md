# DASHBOARD NAVIGATION MAP

## 1. Outbound Dashboard Navigation Links

Every widget and card on the dashboard acts as a gateway to deep operational views.

| Source Dashboard Element | Trigger | Target Destination Route | Navigation Type |
|---|---|---|---|
| **Cash KPI Card** | Click Card | `/finance/cash-flow` | Next.js Router Push |
| **Booked Revenue KPI Card** | Click Card | `/bookings` | Next.js Router Push |
| **SLA Breaches KPI Card** | Click Card | `/leads?filter=sla_breached` | Next.js Router Push |
| **Receivables KPI Card** | Click Card | `/finance` | Next.js Router Push |
| **Velos Leaderboard Pill** | Click Badge | `/performance/velos` | Next.js Link Navigation |
| **Attention Feed Item** | Click Row | Related entity detail page (e.g., `/leads/[id]`) | Next.js Link Navigation |
| **Activity Feed Item** | Click Row | Related entity page | Next.js Link Navigation |
