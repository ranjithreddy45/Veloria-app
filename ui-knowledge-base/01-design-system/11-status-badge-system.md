# Phase 11: Status Badge System

## 1. Badge Component (`src/components/ui/badge.tsx`)

| Status | Badge Color / Style | Purpose |
|---|---|---|
| **Default / Active** | `bg-primary text-primary-foreground` | Active status |
| **Success / Paid / Won** | `bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400` | Approved / Success |
| **Warning / Hold / Pending**| `bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400` | Warning / Pending |
| **Destructive / Lost** | `bg-destructive/10 text-destructive` | Rejected / Cancelled |
| **Outline / Draft** | `border border-border text-foreground` | Draft / Neutral |
