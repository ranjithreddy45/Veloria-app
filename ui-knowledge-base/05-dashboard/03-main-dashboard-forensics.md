# MAIN DASHBOARD DEEP FORENSICS (`/dashboard`)

## 1. Page Header Forensics

The primary `/dashboard` header is rendered dynamically inside [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/dashboard/page.tsx).

```
┌──────────────────────────────────────────────────────────┐
│ WEDNESDAY, 23 SEPTEMBER · OWNER LENS                     │
│ Good morning, Alex 👋 Here's your venue summary today.   │
│ Track 4 urgent items requiring your immediate attention. │
│ [ 🏆 #3 of 14 · 1,250 pts ]                             │
└──────────────────────────────────────────────────────────┘
```

### Controls Inventory

- **CONTROL-0501: Date & Role Lens Subtitle**
  - **Label**: `{today} · {view.lensLabel}`
  - **Format**: `Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })`
  - **Source File**: [page.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/dashboard/page.tsx#L40-L45)

- **CONTROL-0502: Personalized Salutation & Headline**
  - **Headline**: `{view.greeting.salutation} {view.greeting.headline}`
  - **Lede Text**: `{view.greeting.lede}`
  - **Logic Source**: `buildGreeting()` in [summary.ts](file:///Users/fci/Documents/Veloria-app/src/lib/home/summary.ts)

- **CONTROL-0503: Velos Leaderboard Pill**
  - **Label**: `#3 of 14 · 1,250 pts`
  - **Target Route**: `/performance/velos`
  - **Condition**: Renders when `velos && velos.players > 0`.

- **CONTROL-0504: Degraded Data Status Banner**
  - **Condition**: Renders when `view.degraded === true`.
  - **Message**: `"Some figures could not be loaded just now, so they are left out below rather than guessed. Reload to try again."`
