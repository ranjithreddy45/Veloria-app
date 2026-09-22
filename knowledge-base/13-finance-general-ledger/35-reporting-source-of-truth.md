# 35 Reporting Source of Truth

## Unified Ledger Policy

All core financial reports derive strictly from `FinJournalLine` and `FinAccount.currentBalance`. Reports do not compute financial health from raw invoice or payment arrays directly.
