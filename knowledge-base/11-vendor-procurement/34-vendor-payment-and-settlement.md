# 34 - Vendor Payment & Settlement

---

## 💸 Payout Settlement Flow

- **Model**: `Payout` (`prisma.payout`).
- **Trigger**: When Finance processes a payout (`postPayoutPaid`), the system credits Bank (`1010`) and debits Accounts Payable (`2100`), clearing the vendor bill balance.
