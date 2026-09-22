# 21 - Refunds Subsystem

---

## 💸 Refund Handling

- **Fields**: `Payment` stores `refundedAt`, `refundReason`, `refundId`, `refundedById`.
- **GL Posting**: Refunding a payment triggers `reversePaymentEntry()` in `src/lib/finance/receivables.ts`, reversing the cash debit and re-establishing Accounts Receivable.
