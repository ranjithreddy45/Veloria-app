# 29 Vendor Bill Financial Integration

## Accrual & Payout Integration

Vendor bill approval acts as the primary expense accrual engine (`src/actions/vendor-bill.actions.ts`), creating an explicit liability (`2100`) before cash disbursement.
