# 08 Double-Entry Validation Engine

## Verification & Guard Rails

The Veloria Grand double-entry engine enforces strict mathematical identity before committing any database transaction:

$$\sum \text{Debits} = \sum \text{Credits}$$

---

## Validation Mechanisms

1. **Floating-Point Precision Guard (`Math.abs(totalDebit - totalCredit) > 0.01`)**:
   Prevents currency rounding errors from rejecting valid balanced transactions while blocking legitimate imbalances.

2. **Transaction Boundary Locking**:
   The validation occurs *inside* the active `Prisma.TransactionClient` (`tx`). If an imbalance occurs, `tx` aborts immediately and reverts all database modifications.

3. **Line-Item Verification**:
   - Rejects negative debit or credit amounts.
   - Ensures non-empty lines array (`lines.length >= 2`).
   - Verifies existence and active status of all target `FinAccount` IDs.

---

## Code Reference

```typescript
// CODE VERIFIED: src/lib/finance/ledger.ts
const totalDebit = params.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
const totalCredit = params.lines.reduce((sum, l) => sum + (l.credit || 0), 0);

if (Math.abs(totalDebit - totalCredit) > 0.01) {
  throw new Error(`Unbalanced Journal Entry: Debits (${totalDebit.toFixed(2)}) != Credits (${totalCredit.toFixed(2)})`);
}
```
