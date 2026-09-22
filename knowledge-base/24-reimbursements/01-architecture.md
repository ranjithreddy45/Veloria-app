# 01 Expense Claims & Reimbursements Architecture

`CODE VERIFIED`

## Subsystem Architecture Overview

The Veloria Grand Expense Claims & Reimbursements subsystem enables employees to submit expense reimbursement claims (Travel, Fuel, Telephone, Medical, Books, Other), routes claims through a multi-level approval workflow, and settles payments either via direct Finance disbursement or integrated Payroll runs.

```
+-----------------------------------------------------------------------------------+
|                        EMPLOYEE REIMBURSEMENT LIFECYCLE                           |
+-----------------------------------------------------------------------------------+
       |                                      |                                   |
       v                                      v                                   v
+-----------------------+          +-----------------------+          +-----------------------+
|  CLAIM SUBMISSION     |          |  MULTI-LEVEL APPROVAL |          | PAYMENT & SETTLEMENT  |
|  (/me/reimbursements) |          |   (/me/approvals)     |          |(/finance/reimbursem..)|
+-----------------------+          +-----------------------+          +-----------------------+
| Category, Title, Amt  |          | Level 1: Manager/Admin|          | Finance Direct Payout |
| Fuel 50L Cap Check    |          | Level 2: HR / Dept    |          | Payroll Run Scheduled |
| Bill Attachments      |          | Level 3: Finance      |          | GL Journal Post       |
+-----------------------+          +-----------------------+          +-----------------------+
```

## Architectural Layers

1. **User Interface (React Components)**:
   - Employee ESS: `/me/reimbursements` (`src/app/(dashboard)/me/reimbursements/page.tsx`).
   - Approver Queue: `/me/approvals` (`src/app/(dashboard)/me/approvals/page.tsx`).
   - HR Payroll Management: `/people/payroll/reimbursements` (`src/app/(dashboard)/people/payroll/reimbursements/page.tsx`).
   - Finance Payout Console: `/finance/reimbursements` (`src/app/(dashboard)/finance/reimbursements/page.tsx`).

2. **Server Actions (`src/actions/hr-reimbursement.actions.ts`)**:
   - `submitReimbursement()`: Validates fuel cap, creates `HrReimbursementClaim`, uploads attachments.
   - `decideReimbursement()`: Handles Level 1, Level 2, and Level 3 approvals or rejections.
   - `scheduleReimbursementPayment()` / `markReimbursementPaid()`: Finance settlement actions.

3. **Domain Logic (`src/lib/hr/claim-workflow.ts` & `src/lib/hr/reimbursement.ts`)**:
   - `resolveClaimApprovers()`: Resolves Level 1, Level 2, and Level 3 approver rules from `HrReimbursementApprover`.
   - `notifyClaimStep()`: Dispatches in-app `Notification` and Resend emails.

4. **Persistence Layer (Prisma ORM)**:
   - Primary Models: `HrReimbursementClaim`, `HrClaimAttachment`, `HrReimbursementApprover`, `HrClaimEvent`, `ActivityLog`.
