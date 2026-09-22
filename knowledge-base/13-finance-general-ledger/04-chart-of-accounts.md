# 04 Chart of Accounts (COA) Implementation

## Overview

The Chart of Accounts (COA) in Veloria Grand is seeded and managed via `src/lib/finance/coa-seed.ts` and the `FinAccount` model in `prisma/schema.prisma`. Every financial transaction must reference valid `FinAccount` records.

---

## Production Standard Account Code Inventory

The system defines standard 4-digit numerical account codes:

```typescript
// CODE VERIFIED: src/lib/finance/coa-seed.ts
export const FIN_ACCOUNT_CODES = {
  BANK_DEFAULT: '1010',            // ASSET: Bank Account
  CASH_DEFAULT: '1020',            // ASSET: Cash Account
  AR_DEFAULT: '1200',              // ASSET: Accounts Receivable
  VENDOR_ADVANCE_DEFAULT: '1300',  // ASSET: Vendor Advances / Prepaid
  AP_DEFAULT: '2010',              // LIABILITY: Accounts Payable (Procurement)
  VENDOR_PAYABLE_DEFAULT: '2100',  // LIABILITY: Vendor Payables (Vendor Bills)
  CGST_PAYABLE_DEFAULT: '2210',    // LIABILITY: CGST Payable
  SGST_PAYABLE_DEFAULT: '2220',    // LIABILITY: SGST Payable
  IGST_PAYABLE_DEFAULT: '2230',    // LIABILITY: IGST Payable
  REVENUE_EVENT_DEFAULT: '4010',   // REVENUE: Event Sales Revenue
  EXPENSE_FOOD_BEV: '5010',        // EXPENSE: Food & Beverage
  EXPENSE_VENUE_INFRA: '5020',     // EXPENSE: Venue & Infrastructure
  EXPENSE_DECOR_FLORAL: '5030',    // EXPENSE: Decor & Floral
  EXPENSE_AUDIO_VISUAL: '5040',    // EXPENSE: Audio/Visual & Lighting
  EXPENSE_LOGISTICS: '5050',       // EXPENSE: Logistics & Transport
  EXPENSE_STAFFING: '5060',        // EXPENSE: Staffing & Security
  EXPENSE_LICENSES: '5070',        // EXPENSE: Licenses & Permits
  EXPENSE_MISC_EVENT: '5080',      // EXPENSE: Miscellaneous Event Expenses
  EXPENSE_GENERAL_SUPPLIES: '5230' // EXPENSE: General Supplies
};
```

---

## FinAccount Seed Template Data

The `COA_TEMPLATE` array in `coa-seed.ts` populates `FinAccount`:

| Code | Account Name | Type (`FinAccountType`) | Default Balance Nature | System Flag |
| :--- | :--- | :--- | :--- | :--- |
| `1010` | Main Bank Account | `ASSET` | Debit | `isSystem: true` |
| `1020` | Petty Cash Account | `ASSET` | Debit | `isSystem: true` |
| `1200` | Accounts Receivable | `ASSET` | Debit | `isSystem: true` |
| `1300` | Vendor Advances | `ASSET` | Debit | `isSystem: true` |
| `2010` | Accounts Payable (Procurement) | `LIABILITY` | Credit | `isSystem: true` |
| `2100` | Vendor Payables | `LIABILITY` | Credit | `isSystem: true` |
| `2210` | CGST Output Tax Payable | `LIABILITY` | Credit | `isSystem: true` |
| `2220` | SGST Output Tax Payable | `LIABILITY` | Credit | `isSystem: true` |
| `2230` | IGST Output Tax Payable | `LIABILITY` | Credit | `isSystem: true` |
| `4010` | Event Revenue | `REVENUE` | Credit | `isSystem: true` |
| `5010`-`5230` | Operational & Event Expenses | `EXPENSE` | Debit | `isSystem: true` |
