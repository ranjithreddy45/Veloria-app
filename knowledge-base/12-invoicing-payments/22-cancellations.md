# 22 - Cancellations & Invoice Voids

---

## ❌ Invoice Cancellation (`cancelPending`)

- **Fields**: `Invoice` stores `cancelPending`, `cancelReason`, `cancelledById`, `cancelledAt`.
- **GL Reversal**: Cancelling a `SENT` invoice calls `reverseReceivableEntry()`, reversing the Accounts Receivable debit and Sales Revenue credit in the General Ledger.
