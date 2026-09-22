# 07 Journal Entry Engine (`ledger.ts`)

## Transaction Engine (`src/lib/finance/ledger.ts`)

The central function for creating immutable financial ledger entries is `createJournalEntryWithinTx`:

```typescript
// CODE VERIFIED: src/lib/finance/ledger.ts
export async function createJournalEntryWithinTx(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    sourceModule: FinSourceModule;
    sourceId?: string;
    narration: string;
    postingDate: Date;
    createdBy?: string;
    lines: {
      accountId: string;
      debit: number;
      credit: number;
      description?: string;
    }[];
  }
) {
  // 1. Period Lock Check
  await assertPeriodIsOpenWithinTx(tx, params.organizationId, params.postingDate);

  // 2. Double-Entry Validation
  const totalDebit = params.lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = params.lines.reduce((sum, l) => sum + l.credit, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Unbalanced Journal Entry: Debits (${totalDebit}) != Credits (${totalCredit})`);
  }

  // 3. Sequential Entry Number Allocation
  const entryNumber = await allocateJournalEntryNumberWithinTx(tx, params.organizationId, params.postingDate);

  // 4. Create FinJournalEntry Header
  const journalEntry = await tx.finJournalEntry.create({
    data: {
      organizationId: params.organizationId,
      entryNumber,
      postingDate: params.postingDate,
      sourceModule: params.sourceModule,
      sourceId: params.sourceId,
      narration: params.narration,
      status: 'POSTED',
      createdBy: params.createdBy || 'SYSTEM',
      lines: {
        create: params.lines.map(line => ({
          accountId: line.accountId,
          debit: line.debit,
          credit: line.credit,
          description: line.description
        }))
      }
    }
  });

  // 5. Update Account Balances
  for (const line of params.lines) {
    const account = await tx.finAccount.findUniqueOrThrow({ where: { id: line.accountId } });
    const delta = (account.type === 'ASSET' || account.type === 'EXPENSE')
      ? (line.debit - line.credit)
      : (line.credit - line.debit);

    await tx.finAccount.update({
      where: { id: line.accountId },
      data: { currentBalance: { increment: delta } }
    });
  }

  return journalEntry;
}
```
