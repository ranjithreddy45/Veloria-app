# 05 Account Types & Classification Hierarchy

## FinAccountType Enum

The system uses the standard 5-element financial account classification (`FinAccountType` in `prisma/schema.prisma`):

```prisma
enum FinAccountType {
  ASSET
  LIABILITY
  EQUITY
  REVENUE
  EXPENSE
}
```

---

## Balance Nature Rules & Mathematical Conventions

The system enforces balance conventions inside `src/lib/finance/ledger.ts` when updating `FinAccount.currentBalance`:

```typescript
// CODE VERIFIED: src/lib/finance/ledger.ts
const balanceDelta = (type === 'ASSET' || type === 'EXPENSE')
  ? (debit - credit)
  : (credit - debit);

await tx.finAccount.update({
  where: { id: accountId },
  data: {
    currentBalance: { increment: balanceDelta }
  }
});
```

### Classification Summary Table

| Account Type | Normal Balance | Debit Action | Credit Action | Example Account Codes |
| :--- | :--- | :--- | :--- | :--- |
| **ASSET** | Debit | Increases Balance | Decreases Balance | `1010` (Bank), `1020` (Cash), `1200` (AR), `1300` (Advances) |
| **LIABILITY** | Credit | Decreases Balance | Increases Balance | `2010` (AP Procurement), `2100` (AP Bills), `2210` (CGST) |
| **EQUITY** | Credit | Decreases Balance | Increases Balance | Owners Capital, Retained Earnings |
| **REVENUE** | Credit | Decreases Balance | Increases Balance | `4010` (Event Sales Revenue) |
| **EXPENSE** | Debit | Increases Balance | Decreases Balance | `5010`-`5080` (Event Expenses), `5230` (Supplies) |
