# 31 Approval Hierarchy & Aging Analytics

`CODE VERIFIED`

## Approval Pipeline Analytics (`src/actions/pending-approvals.actions.ts`)

- **Approval Queue Volume**: Tracks active pending requests across Leave, Reimbursements, Payroll Runs, Discount Approvals, and Vendor Bills.
- **Turnaround SLA**: Measures hours elapsed between request creation and final approval decision (`ApprovalDecision`).
