# LEAD ACTION OWNERSHIP MAP

## 1. Action Mutation Trace

```
USER CLICK ──► HANDLER ──► SERVER ACTION ──► PRISMA MUTATION ──► REVALIDATION ──► TOAST
```

- **Assign Lead**: `AssignOwnerPopover` ──► `assignLead()` ──► `prisma.lead.update()` ──► Revalidate ──► Sonner Toast.
