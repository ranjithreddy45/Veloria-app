# 13 Procurement & Goods Receipt to GL Integration

## Accounting Treatment for Received Goods

When a purchase requisition is marked as `RECEIVED` (`postPurchaseReceivedWithinTx` in `src/lib/finance/procurement.ts`), the system recognizes Supplies Expense and Accounts Payable (Procurement).

---

## Journal Entry Structure

| Account Name | Code | Account Type | Debit | Credit |
| :--- | :--- | :--- | :--- | :--- |
| **General Supplies Expense** | `5230` | `EXPENSE` | **Received Goods Value** | - |
| **Accounts Payable (Procurement)** | `2010` | `LIABILITY` | - | **Received Goods Value** |

---

## Code Trace (`src/lib/finance/procurement.ts`)

```typescript
// CODE VERIFIED: src/lib/finance/procurement.ts
export async function postPurchaseReceivedWithinTx(tx: Prisma.TransactionClient, req: PurchaseReqData) {
  const expAccount = await getAccountByCode(tx, FIN_ACCOUNT_CODES.EXPENSE_GENERAL_SUPPLIES);
  const apAccount = await getAccountByCode(tx, FIN_ACCOUNT_CODES.AP_DEFAULT);

  return createJournalEntryWithinTx(tx, {
    organizationId: req.organizationId,
    sourceModule: 'PAYABLE',
    sourceId: req.id,
    narration: `Purchase Requisition #${req.reqNumber} Received`,
    postingDate: new Date(),
    lines: [
      { accountId: expAccount.id, debit: req.totalCost, credit: 0, description: `Received PO #${req.reqNumber}` },
      { accountId: apAccount.id, debit: 0, credit: req.totalCost, description: `AP Accrual PO #${req.reqNumber}` }
    ]
  });
}
```
