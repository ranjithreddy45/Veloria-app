# 33 Bank & Ledger Reconciliation

## Reconciliation Subsystem (`reconcile.ts` & `gl-reconcile.ts`)

- Compares `FinBankTxn` against `FinJournalLine` for `1010`.
- Identifies unmatched bank credits (unallocated deposits) and debits (unmatched payouts).
- Computes reconciled bank balance vs GL book balance.
