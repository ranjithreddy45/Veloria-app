# 46 Finance General Ledger Bridge

## GL Action: `postPayrollRun` (`finance-payroll.actions.ts`)

Creates balanced `FinJournalEntry` with `sourceModule: "PAYROLL"`:
- **Debit**: Salaries Expense `5100` / `5060` (Total Gross)
- **Credit**: Salaries Payable `2230` / `2100` (Total Net)
- **Credit**: Statutory Liabilities (PF `2200`, ESI `2210`, PT `2220`, TDS `2110`)
