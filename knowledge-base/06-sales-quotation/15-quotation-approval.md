# Quotation Approval Workflow

## Overview

Manager review workflow for quotations with special pricing or high discount requests.

---

## Approval Workflow Execution

1. **Trigger**: Sales Exec submits quote with discount > 10%.
2. **State Transition**: `SalesQuotation.status` -> `PENDING_APPROVAL`.
3. **Approval Queue**: Appears in `/approvals` dashboard (`pending-quote-approvals.tsx`).
4. **Manager Action**: `SALES_HEAD` or `ADMIN` clicks **Approve** or **Reject**.
5. **Server Action**: `approveSalesQuotation()` in `src/actions/sales-quotation.actions.ts`.
6. **Result**: On approval, status transitions to `APPROVED` and output JSON is frozen.
