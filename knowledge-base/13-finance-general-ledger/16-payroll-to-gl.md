# 16 Payroll to General Ledger Integration

## Accounting Treatment for Monthly Payroll

When monthly payroll is run and posted (`src/actions/hr-payroll-run.actions.ts` and `src/actions/finance-payroll.actions.ts`), the system creates salary accrual GL entries.

---

## Journal Entry Structure (Salary Accrual)

| Account Name | Code | Account Type | Debit | Credit |
| :--- | :--- | :--- | :--- | :--- |
| **Staffing & Salary Expense** | `5060` | `EXPENSE` | **Gross Salary** | - |
| **Salary Payable** | `2100` | `LIABILITY` | - | **Net Salary Payable** |
| **PF / ESI / TDS Payable** | `2200` | `LIABILITY` | - | **Statutory Deductions** |

---

## Net Salary Payout

| Account Name | Code | Account Type | Debit | Credit |
| :--- | :--- | :--- | :--- | :--- |
| **Salary Payable** | `2100` | `LIABILITY` | **Net Salary Amount** | - |
| **Main Bank Account** | `1010` | `ASSET` | - | **Net Salary Amount** |
