# DASHBOARD WIDGET INVENTORY

## 1. Widget Inventory Summary

The primary dashboard consists of 6 core reusable widgets.

---

## 2. Detailed Widget Inventory

### WIDGET-0501: Home KPIs Strip (`HomeKpis`)
- **Screen**: `/dashboard`
- **Component File**: [home-kpis.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/dashboard/_components/home-kpis.tsx)
- **Purpose**: Displays 4 high-level KPI cards with trend indicators and sparklines.
- **Data Source**: `view.kpis` from `getHomeView()`
- **Click Behavior**: Clicking a KPI card navigates to the underlying detail module (e.g. `/leads`, `/bookings`, `/payments`).

### WIDGET-0502: Priority Action Feed (`AttentionFeed`)
- **Screen**: `/dashboard`
- **Component File**: [attention-feed.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/dashboard/_components/attention-feed.tsx)
- **Purpose**: "Needs you now" priority action items requiring immediate user action.
- **Displayed Data**: Overdue follow-ups, SLA breaches, pending quotation approvals, unassigned leads, payment proof verifications.
- **Data Source**: `view.attention` from `getHomeView()`

### WIDGET-0503: Dynamic Side Card (`SideCard`)
- **Screen**: `/dashboard`
- **Component File**: [side-card.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/dashboard/_components/side-card.tsx)
- **Purpose**: Displays role-specific context (e.g. quote views for Sales, event schedule for Ops, cash flow summary for Finance).
- **Data Source**: `view.side` from `getHomeView()`

### WIDGET-0504: Live Activity Stream (`ActivityFeed`)
- **Screen**: `/dashboard`
- **Component File**: [activity-feed.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/dashboard/_components/activity-feed.tsx)
- **Purpose**: "Team pulse" - live audit log of recent system events across leads, quotes, bookings, and payments.
- **Data Source**: Client-side fetch via `/api/activity` with pulsing green live indicator.

### WIDGET-0505: Getting Started Guide (`GettingStarted`)
- **Screen**: `/dashboard`
- **Component File**: [getting-started.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/dashboard/_components/getting-started.tsx)
- **Purpose**: Interactive adoption guide with progress bar and actionable step links.
- **Auto-Hide**: Automatically hides when all steps are completed or when dismissed via `localStorage`.

### WIDGET-0506: Welcome Tour Modal (`WelcomeTour`)
- **Screen**: `/dashboard`
- **Component File**: [welcome-tour.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/dashboard/_components/welcome-tour.tsx)
- **Purpose**: 4-step modal orientation for first-time login users.
- **State Storage**: `localStorage.setItem("vg_welcome_seen_v1", "1")`.
