# 12 Multi-Level Approval Hierarchy

`CODE VERIFIED`

## Approval Levels & Escalation Rules (`src/lib/hr/claim-workflow.ts`)

1. **Level 1 Approval**:
   - First-level validation. Uses `HrReimbursementApprover` rule where `level = 1` and `scope = 'ALL'` (or `CATEGORY_EVENT`).
   - If no Level 1 approver configured, auto-routes to active `SUPER_ADMIN` users.
2. **Level 2 Approval**:
   - Department-specific approval (`scope = departmentId` or `ALL` fallback).
   - If no Level 2 rule is configured, claim auto-advances from Level 1 directly to `APPROVED` (Level 3 / Finance).
3. **Level 3 Approval (Finance)**:
   - Claims in `APPROVED` status are visible to Finance (`role = FINANCE` or `hr:payroll` holders).
   - Finance approves payment by setting payment reference (`markReimbursementPaid`) or scheduling on payroll run (`scheduleReimbursementPayment`).
