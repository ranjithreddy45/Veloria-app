# 42 Financial Validation & Business Rules

## Key Enforced Rules

1. `Sum(Debits) == Sum(Credits)` (Max tolerance `0.01`).
2. Postings blocked when `FinPeriod.status` is `CLOSED` or `LOCKED`.
3. Account codes must exist and be active (`isActive: true`).
4. Reversal requires non-reversed status (`POSTED`).
5. Invoice issue requires positive total amount (`totalAmount > 0`).
