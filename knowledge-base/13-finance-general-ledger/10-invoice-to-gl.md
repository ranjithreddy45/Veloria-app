# 10 Invoice to General Ledger Integration

## Accounting Treatment for Issued Invoices

When an invoice is issued (`postInvoiceIssued` in `src/lib/finance/receivables.ts`), the system recognizes Accounts Receivable, Net Revenue, and Output Tax Liabilities.

---

## Journal Entry Structure

| Account Name | Code | Account Type | Debit | Credit |
| :--- | :--- | :--- | :--- | :--- |
| **Accounts Receivable** | `1200` | `ASSET` | **Total Invoice Amount** | - |
| **Event Sales Revenue** | `4010` | `REVENUE` | - | **Subtotal (Net)** |
| **CGST Payable** | `2210` | `LIABILITY` | - | **CGST Amount** |
| **SGST Payable** | `2220` | `LIABILITY` | - | **SGST Amount** |
| **IGST Payable** | `2230` | `LIABILITY` | - | **IGST Amount** |

---

## Code Trace (`src/lib/finance/receivables.ts`)

```typescript
// CODE VERIFIED: src/lib/finance/receivables.ts
export async function postInvoiceIssued(tx: Prisma.TransactionClient, invoice: InvoiceData) {
  const arAccount = await getAccountByCode(tx, FIN_ACCOUNT_CODES.AR_DEFAULT);
  const revAccount = await getAccountByCode(tx, FIN_ACCOUNT_CODES.REVENUE_EVENT_DEFAULT);
  const cgstAccount = await getAccountByCode(tx, FIN_ACCOUNT_CODES.CGST_PAYABLE_DEFAULT);
  const sgstAccount = await getAccountByCode(tx, FIN_ACCOUNT_CODES.SGST_PAYABLE_DEFAULT);
  const igstAccount = await getAccountByCode(tx, FIN_ACCOUNT_CODES.IGST_PAYABLE_DEFAULT);

  const lines = [
    { accountId: arAccount.id, debit: invoice.totalAmount, credit: 0, description: `AR for Inv #${invoice.invoiceNumber}` },
    { accountId: revAccount.id, debit: 0, credit: invoice.subtotal, description: `Revenue Inv #${invoice.invoiceNumber}` }
  ];

  if (invoice.cgst > 0) lines.push({ accountId: cgstAccount.id, debit: 0, credit: invoice.cgst, description: 'CGST Output' });
  if (invoice.sgst > 0) lines.push({ accountId: sgstAccount.id, debit: 0, credit: invoice.sgst, description: 'SGST Output' });
  if (invoice.igst > 0) lines.push({ accountId: igstAccount.id, debit: 0, credit: invoice.igst, description: 'IGST Output' });

  return createJournalEntryWithinTx(tx, {
    organizationId: invoice.organizationId,
    sourceModule: 'RECEIVABLE',
    sourceId: invoice.id,
    narration: `Invoice #${invoice.invoiceNumber} Issued`,
    postingDate: invoice.issueDate,
    lines
  });
}
```
