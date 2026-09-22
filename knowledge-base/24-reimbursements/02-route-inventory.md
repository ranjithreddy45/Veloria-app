# 02 Route Inventory & Parameter Specifications

`CODE VERIFIED`

## Complete Route Directory for Reimbursements

| Route Path | File Path | User Role | Purpose | Server Actions Used |
| :--- | :--- | :--- | :--- | :--- |
| `/me/reimbursements` | `src/app/(dashboard)/me/reimbursements/page.tsx` | All Staff | Employee self-service claim submission & personal history | `listMyReimbursements`, `submitReimbursement`, `cancelMyReimbursement` |
| `/me/approvals` | `src/app/(dashboard)/me/approvals/page.tsx` | Approvers / Admins | Manager & HR approval queue for pending claims | `listMyApprovals`, `decideReimbursement`, `requestClaimInfo` |
| `/people/payroll/reimbursements` | `src/app/(dashboard)/people/payroll/reimbursements/page.tsx` | `HR_MANAGER`, `ADMIN` | HR payroll run reimbursement scheduling console | `listReimbursements`, `scheduleReimbursementPayment` |
| `/finance/reimbursements` | `src/app/(dashboard)/finance/reimbursements/page.tsx` | `FINANCE`, `ADMIN` | Finance direct payment & payout settlement dashboard | `listFinanceReimbursements`, `markReimbursementPaid` |
