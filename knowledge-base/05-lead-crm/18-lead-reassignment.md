# Lead Reassignment Mechanics

## Overview

Reassigning lead ownership between sales executives or BD teams.

---

## Technical Flow

- **Single Reassignment**: Triggered via `reassign-owner-popover.tsx`.
- **Bulk Reassignment**: Triggered via `bulk-assign-popover.tsx` on `/leads` or `/bd/leads`.
- **Server Action**: `reassignLeads()` in `src/actions/lead.actions.ts`.
- **Email Notification**: Triggers `sendLeadAssignedEmail()` (`src/lib/crm/lead-assigned-email.ts`) notifying the new owner.
