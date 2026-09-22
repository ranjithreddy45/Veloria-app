# Quotation Creation Workflows

## Overview

Quotation creation pathways from Lead CRM pre-population or direct sales entry.

---

## Creation Execution Pathway

1. **User Action**: Click **"Create Quotation"** on Lead detail page (`/leads/[leadId]`) or navigate to `/quotations/new`.
2. **Component**: `src/app/(dashboard)/quotations/new/page.tsx` & `tier-builder.tsx`.
3. **Data Pre-Population**:
   - `Lead.contactId` -> `SalesQuotation.clientName`, `clientPhone`, `clientEmail`.
   - `Lead.preferredVenueId` -> Venue pricing rules & tax slabs.
   - `Lead.guestCount` -> Initial guest count.
   - `Lead.eventDate` & `slot` -> Yield pricing date-demand multipliers.
4. **Server Action**: `createSalesQuotation()` in `src/actions/sales-quotation.actions.ts`.
5. **Monotonic Serial Generator**: Allocates serial quote number (e.g. `VG-Q-00142`) inside a serializable transaction.
