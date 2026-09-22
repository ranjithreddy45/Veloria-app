# 07 Payroll Enums & Status Codes

## Enum Definitions

### `PayrollStatus`
- `DRAFT`: Newly initialized payroll run; calculations mutable.
- `APPROVED` / `LOCKED`: Calculation finalized and frozen against updates.
- `PAID`: Salary disbursed and posted to General Ledger.
