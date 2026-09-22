# 31 Accounting Periods & Fiscal Year Control

## Fiscal Period Model (`FinPeriod`)

Periods are defined monthly (e.g. `2026-09`). The system checks period status before creating any journal entry:

```typescript
// CODE VERIFIED: src/lib/finance/ledger.ts
export async function assertPeriodIsOpenWithinTx(tx: Prisma.TransactionClient, orgId: string, date: Date) {
  const period = await tx.finPeriod.findFirst({
    where: {
      organizationId: orgId,
      startDate: { lte: date },
      endDate: { gte: date }
    }
  });

  if (period && (period.status === 'CLOSED' || period.status === 'LOCKED')) {
    throw new Error(`Cannot post transaction: Fiscal period ${period.periodName} is ${period.status}`);
  }
}
```
