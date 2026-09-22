# Lead to Quotation Flow

## Overview

Detailing how lead data pre-populates the dynamic quotation builder engine.

---

## Execution Pathway

1. **User Action**: Sales Executive clicks **"Create Quotation"** on `/leads/[leadId]`.
2. **Navigation**: Redirects to `/quotations/new?leadId=[leadId]`.
3. **Data Mapping**:
   - `Lead.contactId` -> `Quotation.contactId`
   - `Lead.preferredVenueId` -> `Quotation.venueId`
   - `Lead.guestCount` -> `Quotation.guestCount`
   - `Lead.perPlateBudget` -> Initial plate pricing tier.
4. **Server Action**: `createQuotationFromLead()` in `src/actions/lead.actions.ts`.
