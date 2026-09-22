# 09 Journal Posting Lifecycle

## Lifecycle States (`FinJournalStatus`)

A `FinJournalEntry` traverses two lifecycle states:

```
    ┌───────────┐         Source Action (Invoice, Payment, Bill)
    │  [NEW]    │ ───────────────────────────────────────────┐
    └───────────┘                                           │
                                                            ▼
                                                    ┌───────────────┐
                                                    │    POSTED     │
                                                    └───────┬───────┘
                                                            │
                                                            │ Cancellation / Reversal Request
                                                            ▼
                                                    ┌───────────────┐
                                                    │   REVERSED    │
                                                    └───────────────┘
```

---

## State Transition Rules

1. **Creation -> `POSTED`**:
   All transactions created by Server Actions are directly written in `POSTED` status within the atomic database transaction. Draft journal entries are not stored in `FinJournalEntry`.

2. **`POSTED` -> `REVERSED`**:
   Posted journal entries are **immutable**. They cannot be updated or deleted. To cancel a posted transaction, the engine executes a reversal function (`reverseJournalEntryWithinTx`), which:
   - Sets the original entry status to `REVERSED`.
   - Creates a new `FinJournalEntry` with swapped Debits and Credits.
   - Populates `reversalOfId` linking back to the original entry.
