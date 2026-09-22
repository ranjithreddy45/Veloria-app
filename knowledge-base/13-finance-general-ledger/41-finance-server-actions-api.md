# 41 Finance Server Actions & API Inventory

## Core Server Action Modules (`src/actions/`)

- `finance.actions.ts`: COA management & general journal creation.
- `invoice.actions.ts`: Invoice issuance & AR tracking.
- `invoice-cancel.actions.ts`: Invoice cancellation & GL reversal.
- `payout.actions.ts`: Vendor payouts & advance settlement.
- `vendor-bill.actions.ts`: Vendor bill approval & expense accrual.
- `finance-tax.actions.ts`: GST calculations & tax filing.
- `finance-tally.actions.ts`: Tally XML generation.
- `finance-payroll.actions.ts`: Payroll GL posting.
- `finance-einvoice.actions.ts`: E-invoice IRN requests.
