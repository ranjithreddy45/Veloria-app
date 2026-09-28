# DASHBOARD ACTIVITY FEEDS & ALERTS

## 1. Live Activity Feed (`ActivityFeed`)

Implemented in [activity-feed.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/dashboard/_components/activity-feed.tsx).

- **Header**: Live Activity with animated pinging green dot indicator.
- **Data Source**: Fetches from `/api/activity` Endpoint.
- **Event Types**: Lead created, Quotation viewed, Booking confirmed, Payment received, BEO approved.
- **Empty State**: `"No recent activity to show right now."`

---

## 2. Priority Alert Feed (`AttentionFeed`)

Implemented in [attention-feed.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/dashboard/_components/attention-feed.tsx).

- **Purpose**: Urgent actionable items categorized into:
  - 🔴 **Critical**: SLA Breaches, Payment Cancellations Requested.
  - 🟡 **Warning**: Overdue Follow-ups, Quotations Pending Approval.
  - 🔵 **Info**: Unassigned Leads, Upcoming Site Visits.
