# Contract Creation Workflows

## Overview

Contract creation pathways from template rendering, quotation conversion, or direct entry.

---

## Creation Execution Pathway

1. **User Action**: Sales Executive clicks **"Generate Contract"** on an accepted quotation or navigates to `/contracts/new`.
2. **Template Selection**: Selects `ContractTemplate` (e.g. "Standard Wedding Venue Agreement").
3. **Variable Substitution**: `src/lib/acq/contract-template.ts` merges client and event data into placeholders:
   - `{{clientName}}` -> Contact Name
   - `{{eventDate}}` -> Event Date
   - `{{totalAmount}}` -> Quotation Grand Total
4. **Server Action**: `createContract()` in `src/actions/contract.actions.ts`.
5. **Database Operation**: Inserts `Contract` / `SignatureRequest` record with `status: DRAFT`.
