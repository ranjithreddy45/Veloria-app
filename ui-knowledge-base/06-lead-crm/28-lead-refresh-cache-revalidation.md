# LEAD REFRESH, CACHE & REVALIDATION

## 1. Revalidation Rules

- Lead status & owner changes execute `revalidatePath("/leads")` and `revalidatePath("/leads/[leadId]")`.
- Optimistic updates apply on Kanban drag-and-drop and status dropdown changes.
