# 27 HR & Payroll Audit Controls

`CODE VERIFIED`

## Payroll Audit Trail (`src/actions/hr-payroll-run.actions.ts`)

- **Payroll Run States**: `DRAFT` -> `CALCULATED` -> `VERIFIED` -> `APPROVED` -> `PAID` -> `POSTED_TO_GL`.
- **Audit Lock**: Once a payroll run reaches `APPROVED` status, linked `HrPayslip` records and attendance inputs are locked against modification.
- **Change Log**: Salary structure modifications (`HrSalaryStructure`) record predecessor version history, modifier ID, and effective date.
