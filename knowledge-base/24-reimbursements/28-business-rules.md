# 28 Master Business Rule Register

`CODE VERIFIED`

| Rule ID | Business Rule | Enforcement Location | Code Evidence | Status |
| :--- | :--- | :--- | :--- | :--- |
| `REIM-BR-001` | Monthly Fuel Limit = 50 Liters | `submitReimbursement()` | `src/actions/hr-reimbursement.actions.ts` | `IMPLEMENTED` |
| `REIM-BR-002` | Mandatory Liters for Fuel Claims | `submitReimbursement()` | `src/actions/hr-reimbursement.actions.ts` | `IMPLEMENTED` |
| `REIM-BR-003` | Max 10MB Attachment per Claim | `addClaimAttachments()` | `src/actions/hr-reimbursement.actions.ts` | `IMPLEMENTED` |
| `REIM-BR-004` | 2-Level Approval + Finance Settlement | `claim-workflow.ts` | `src/lib/hr/claim-workflow.ts` | `IMPLEMENTED` |
| `REIM-BR-005` | Locked against edits after L1 Approval | `addClaimAttachments()` | `src/actions/hr-reimbursement.actions.ts` | `IMPLEMENTED` |
