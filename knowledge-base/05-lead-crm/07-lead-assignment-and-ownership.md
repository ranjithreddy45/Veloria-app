# Lead Assignment & Ownership

## Overview

Lead ownership determines which Sales Executive or BD team member is responsible for managing a lead. Ownership is assigned manually or via automated routing routines.

---

## Assignment Mechanisms

1. **Manual Single Assignment**: Exec/Manager selects owner via `assign-owner-popover.tsx` invoking `assignLeadOwner()` in `src/actions/lead.actions.ts`.
2. **Bulk Reassignment**: Sales Head selects multiple leads in `leads-table.tsx` and triggers `bulk-assign-popover.tsx`.
3. **Automated Assignment**: Pipeline router (`src/lib/lead-pipeline.ts`) assigns incoming leads based on rep availability (`RepAvailability` model) and active lead limits.

---

## Database Fields & Auditing

- **`Lead.assignedToId`**: Foreign key to `User` model.
- **`LeadRoutingDecision`**: Records historical routing evaluation, assigned rep ID, rule matched, and timestamp.
