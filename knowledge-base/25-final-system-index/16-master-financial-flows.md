# Phase 16: Master Financial Flows

## 1. Double-Entry Accounting Invariants
- Every transaction generates balanced `FinJournalLine` entries (`SUM(debit) == SUM(credit)`).
- Posted journal entries (`isPosted = true`) are immutable; adjustments require explicit reversal entries.
- Accounting periods (`FinPeriod`) prevent posting to closed fiscal months.

## 2. Core Financial Mappings
- **Customer Invoice**: Debit Accounts Receivable (`1200`), Credit Sales Revenue (`4000`), Credit GST Payable (`2200`).
- **Payment Receipt**: Debit Bank / Cash (`1010` / `1020`), Credit Accounts Receivable (`1200`).
- **Vendor Bill (AP)**: Debit Expense / Stock (`5000` / `1300`), Credit Accounts Payable (`2100`).
- **Payroll Posting**: Debit Payroll Expense (`5100`), Credit Payroll Payable (`2150`), Credit Statutory Deductions (`2210`).
- **Expense Claim Disbursement**: Debit Employee Expense (`5200`), Credit Bank (`1010`).
