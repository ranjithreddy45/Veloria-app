# 36 Reversal & Correction Mechanisms

## Audit-Safe Counter Entries

The platform strictly prohibits deleting database records in `FinJournalEntry`. Any correction is executed via `reverseJournalEntryWithinTx`, creating a linked counter-entry with swapped debit and credit lines.
