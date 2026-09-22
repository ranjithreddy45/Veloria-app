# Route to Server Action Map

## Overview

Traces key page routes to the primary Next.js Server Actions invoked during user interaction.

---

## Action Mapping

| Route | Primary Server Action | File Path |
|---|---|---|
| `/leads/new` | `createLead()` | `src/lib/actions/lead.ts` |
| `/quotations/new` | `generateQuotation()` | `src/lib/actions/quotation.ts` |
| `/reimbursements` | `submitReimbursement()` | `src/lib/actions/reimbursement.ts` |
| `/leave` | `applyLeave()` | `src/lib/actions/leave.ts` |
| `/client/invoices` | `executePayment()` | `src/lib/actions/client-portal.ts` |
