# 17 Customer Refund to GL Integration

## Accounting Treatment for Payment Refunds

When a customer payment is refunded (`src/actions/payment.actions.ts` / Razorpay refund), the system reverses the original payment receipt GL entry.

---

## Journal Entry Structure

| Account Name | Code | Account Type | Debit | Credit |
| :--- | :--- | :--- | :--- | :--- |
| **Accounts Receivable** | `1200` | `ASSET` | **Refund Amount** | - |
| **Main Bank Account** | `1010` | `ASSET` | - | **Refund Amount** |
