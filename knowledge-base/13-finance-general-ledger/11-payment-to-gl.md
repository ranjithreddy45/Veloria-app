# 11 Payment to General Ledger Integration

## Accounting Treatment for Customer Payments

When a customer payment is received and confirmed (`postPaymentReceived` in `src/lib/finance/receivables.ts`), the system credits Accounts Receivable and debits Bank or Cash.

---

## Journal Entry Structure

| Account Name | Code | Account Type | Debit | Credit |
| :--- | :--- | :--- | :--- | :--- |
| **Main Bank Account** (or Petty Cash `1020`) | `1010` | `ASSET` | **Payment Amount** | - |
| **Accounts Receivable** | `1200` | `ASSET` | - | **Payment Amount** |

---

## Code Trace (`src/lib/finance/receivables.ts`)

```typescript
// CODE VERIFIED: src/lib/finance/receivables.ts
export async function postPaymentReceived(tx: Prisma.TransactionClient, payment: PaymentData) {
  const bankCode = payment.paymentMode === 'CASH'
    ? FIN_ACCOUNT_CODES.CASH_DEFAULT
    : FIN_ACCOUNT_CODES.BANK_DEFAULT;

  const bankAccount = await getAccountByCode(tx, bankCode);
  const arAccount = await getAccountByCode(tx, FIN_ACCOUNT_CODES.AR_DEFAULT);

  return createJournalEntryWithinTx(tx, {
    organizationId: payment.organizationId,
    sourceModule: 'BANK',
    sourceId: payment.id,
    narration: `Payment Received (${payment.paymentMode}) for Inv #${payment.invoiceNumber}`,
    postingDate: payment.paymentDate,
    lines: [
      { accountId: bankAccount.id, debit: payment.amount, credit: 0, description: `Receipt via ${payment.paymentMode}` },
      { accountId: arAccount.id, debit: 0, credit: payment.amount, description: `AR Settlement Inv #${payment.invoiceNumber}` }
    ]
  });
}
```
