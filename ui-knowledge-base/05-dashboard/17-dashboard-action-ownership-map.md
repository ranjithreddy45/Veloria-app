# DASHBOARD ACTION OWNERSHIP MAP

## 1. Dashboard Action Trace Map

This map traces every user click action on the dashboard to its server-side mutation and UI side effect.

```
USER ACTION ──► CLIENT HANDLER ──► SERVER ACTION ──► PRISMA MUTATION ──► REVALIDATION ──► UI FEEDBACK
```

---

## 2. Action Trace Inventory

### ACTION-0501: Assign Lead from Attention Feed
- **UI Trigger**: `"Assign"` button on Attention Feed lead row
- **Client Handler**: `onAssign(leadId, userId)`
- **Server Action**: `assignLeadAction()`
- **Prisma Mutation**: `prisma.lead.update({ where: { id }, data: { assignedToId } })`
- **Side Effect**: Emits notification, revalidates `/dashboard` path.
- **UI Response**: Sonner toast `"Lead assigned successfully"`, row removed from Attention Feed.

### ACTION-0502: Dismiss Getting Started Checklist
- **UI Trigger**: `X` button on `GettingStarted` card
- **Client Handler**: `dismiss()`
- **Storage Side Effect**: `localStorage.setItem("vg_getting_started_dismissed_v1", "1")`
- **UI Response**: Card hides smoothly from render tree.
