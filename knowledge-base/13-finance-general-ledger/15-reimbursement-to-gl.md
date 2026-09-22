# 15 Employee Reimbursement to GL Integration

## Accounting Treatment for Expense Claims

When an employee reimbursement claim is approved and settled (`src/actions/hr-reimbursement.actions.ts`), the system recognizes the expense and debits Bank/Cash.

---

## Journal Entry Structure

| Account Name | Code | Account Type | Debit | Credit |
| :--- | :--- | :--- | :--- | :--- |
| **Miscellaneous Event / Ops Expense** | `5080` | `EXPENSE` | **Reimbursement Amount** | - |
| **Main Bank Account** (or Cash `1020`) | `1010` | `ASSET` | - | **Reimbursement Amount** |
