# 21 Bank & Cash Accounting

## Account Configurations

- **Main Bank Account (`1010`)**: Handles online payment gateway receipts (Razorpay), bank transfers (NEFT/RTGS/IMPS), cheques, and automated payouts.
- **Petty Cash (`1020`)**: Handles cash payment receipts and small staff reimbursements.

---

## Reconciliation Engine (`gl-reconcile.ts`)

Matches bank statement transactions (`FinBankTxn`) against general ledger journal entries (`FinJournalLine`) using transaction reference, date proximity, and exact amount matching rules.
