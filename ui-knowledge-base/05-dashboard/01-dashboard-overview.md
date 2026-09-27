# PHASE 05 — DASHBOARD UI FORENSICS: SYSTEM OVERVIEW

## 1. Executive Summary

This document provides the foundational UI forensic analysis for the **Dashboard System** of **Veloria Grand** (Next.js 16.1.6, React 19.2.3, NextAuth 5, Tailwind CSS 4, Radix UI, Prisma 6.19.2).

The Dashboard layer serves as the primary operational command center for Veloria Grand staff, executives, sales reps, event managers, financial controllers, and HR managers. Unlike simple static analytics pages, Veloria Grand's dashboard architecture dynamically shapes its greeting, KPI widgets, priority action feed ("Needs you now"), side card summaries, and live activity streams according to the user's RBAC role lens (`owner`, `sales`, `ops`, `finance`, `staff`).

```
USER LOGIN ──► NEXTAUTH SESSION ──► ROLE LENS EVALUATION ──► DYNAMIC DASHBOARD (getHomeView) ──► ROLE-TAILORED WIDGETS & COMMAND CENTER
```

---

## 2. Core Dashboard Architecture & Component Layers

| Layer | Primary Technology | Key Source File(s) | Function / Purpose |
|---|---|---|---|
| **Main Dashboard Page** | React Server Component | [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/dashboard/page.tsx) | Renders primary team home, resolves role lens, executes parallel data fetching |
| **Home Data Aggregator** | Server Action / Logic | [home.actions.ts](file:///Users/fci/Documents/Veloria-app/src/actions/home.actions.ts) | Fetches facts from Prisma, checks permissions via `can()`, constructs role lens |
| **KPI Metrics Strip** | React Server/Client Component | [home-kpis.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/dashboard/_components/home-kpis.tsx) | Displays 4 dynamic KPI cards custom-tailored per role lens |
| **Attention Feed ("Needs you now")**| React Client Component | [attention-feed.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/dashboard/_components/attention-feed.tsx) | Priority action queue (SLA breaches, overdue follow-ups, pending approvals) |
| **Side Card Widget** | React Server Component | [side-card.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/dashboard/_components/side-card.tsx) | Role-specific summary card (Quotes viewed, Week schedule, Receivables, etc.) |
| **Team Pulse / Activity Feed** | React Client Component | [activity-feed.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/dashboard/_components/activity-feed.tsx) | Live event activity log with auto-refresh / streaming |
| **First-Run Onboarding** | React Client Component | [getting-started.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/dashboard/_components/getting-started.tsx) | Self-updating initial adoption guide auto-hidden upon completion |
| **Welcome Tour Orientation** | React Client Component | [welcome-tour.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/dashboard/_components/welcome-tour.tsx) | One-time dismissible modal tour stored in `localStorage` |

---

## 3. Supported Dashboard Lenses & Roles

1. **`owner` Lens (`ADMIN`, `GENERAL_MANAGER`)**
   - Focus: Overall venue health, total monthly/weekly booked value, cash collected, urgent approvals, revenue anomalies.
2. **`sales` Lens (`SALES`)**
   - Focus: Assigned lead follow-ups, quote views/conversions, unassigned leads, monthly sales target progress.
3. **`ops` Lens (`OPS`, `KITCHEN`)**
   - Focus: Today's and tomorrow's event schedules, kitchen cover preparation, BEO status, site visits.
4. **`finance` Lens (`FINANCE`)**
   - Focus: Overdue receivables, pending payment proof verifications, invoice/payment cancellation requests, cash flow.
5. **`staff` Lens (`HR`, `EMPLOYEE`)**
   - Focus: Personal task checklist, team pulse, unread notifications, self-service shortcuts.
