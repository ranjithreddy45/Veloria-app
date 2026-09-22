# 16 Payroll Integration & Payslip Inclusion

`CODE VERIFIED`

## Payroll Integration Mechanism

- Scheduled claims (`payFy`, `payMonth`) are fetched during payroll run calculation (`src/actions/hr-payroll-run.actions.ts`).
- Included in `HrPayslip.reimbursements` field.
- If `taxable = false`, reimbursement is added to net payout without triggering PF, ESI, or TDS tax deductions.
