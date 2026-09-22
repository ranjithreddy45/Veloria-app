# 15 Payment & Settlement Engine

`CODE VERIFIED`

## Settlement Execution (`src/actions/hr-reimbursement.actions.ts`)

Approved claims (`status = APPROVED`) can be settled through two distinct pathways:

1. **Direct Finance Payout (`markReimbursementPaid`)**:
   - Finance executes bank transfer/UPI payment outside of payroll.
   - Action updates `status = PAID`, records `paymentRef` and `paidAt`, and posts GL journal entry.

2. **Payroll Run Integration (`scheduleReimbursementPayment`)**:
   - HR/Finance links claim to a payroll run (`payFy`, `payMonth`).
   - Claim amount is included as a non-taxable reimbursement line item in the employee's monthly payslip (`HrPayslip`).
