# 26 Financial Audit & Journal Entry Controls

`CODE VERIFIED`

## General Ledger Audit Integrity (`src/actions/accounting.actions.ts`)

- **Double-Entry Accounting Rule**: Every financial transaction generates balancing debit and credit entries (`FinJournalLine`).
- **Immutability of Closed Periods**: Once a financial period (`FinPeriod`) is set to `CLOSED`, no journal entries can be inserted, edited, or deleted.
- **Reversal Ledger**: Corrective financial entries require a formal reversing entry (`isReversal: true`) linked to the original journal entry.
- **Audit Metadata**: Captures `createdBy`, `approvedBy`, `postedAt`, and source transaction ID (`InvoiceId`, `PaymentId`, `PayoutId`).
