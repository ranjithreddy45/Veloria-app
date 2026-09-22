# Lead Creation Workflows

## Overview

Leads can be created manually by internal staff or automatically by ingestion webhooks and API endpoints.

---

## Manual Creation Flow (Staff / Exec)

1. **User Role**: `SALES_EXEC`, `SALES_HEAD`, `BD_EXECUTIVE`, `BD_HEAD`, `ADMIN`, `SUPER_ADMIN`.
2. **Navigation**: `/leads` -> Click **"New Lead"** button -> Navigate to `/leads/new`.
3. **Component**: `src/app/(dashboard)/leads/_components/lead-form.tsx`.
4. **Validation Schema**: `src/schemas/lead.schema.ts` (`createLeadSchema`).
5. **Server Action**: `createLead()` in `src/actions/lead.actions.ts`.
6. **Database Operation**:
   - Creates or links `Contact` record by phone/email.
   - Inserts `Lead` record with `status: NEW`.
   - Logs `ActivityLog` entry.

---

## Execution Pathway

```
User Role: SALES_EXEC
  ↓
Navigation: /leads -> /leads/new
  ↓
Component: lead-form.tsx
  ↓
Validation: createLeadSchema (Zod)
  ↓
Server Action: createLead() (src/actions/lead.actions.ts)
  ↓
Permission Check: hasPermission(role, "leads:create")
  ↓
Prisma DB: prisma.lead.create() + prisma.contact.upsert()
  ↓
Result: Lead Created & Redirect to /leads/[id]
```
