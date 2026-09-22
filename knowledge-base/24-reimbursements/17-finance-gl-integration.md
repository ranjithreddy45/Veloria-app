# 17 Finance & General Ledger Integration

`CODE VERIFIED`

## General Ledger Accounting Treatment

When a claim is marked paid directly or via payroll:
- **Debit**: Expense Account (e.g. `Account: Travel & Conveyance Expense` or `Account: Vehicle Fuel Expense`).
- **Credit**: Cash / Bank Account (or `Employee Payable` Liability Account).
- Recorded in `FinJournalEntry` with source reference `entityType: REIMBURSEMENT`, `entityId: claimId`.
