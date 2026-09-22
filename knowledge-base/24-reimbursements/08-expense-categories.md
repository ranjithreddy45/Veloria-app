# 08 Expense Categories & Taxability Rules

`CODE VERIFIED`

## Defined Categories (`REIMBURSEMENT_CATEGORIES`)

- **`TRAVEL`**: Outstation travel, local conveyance, lodging. Non-taxable if backed by valid bills.
- **`FUEL`**: Vehicle fuel claims. Subject to strict 50 Liters/month cap. Mandatory `fuelLiters` input.
- **`TELEPHONE`**: Mobile/internet reimbursement. Usually non-taxable allowance.
- **`MEDICAL`**: Employee & dependent medical expense claims.
- **`BOOKS`**: Professional books and learning subscriptions.
- **`OTHER`**: Miscellaneous operational expenses.

### Taxability Handling
- Default: `taxable = false` for official business reimbursements.
- If flagged `taxable = true`, reimbursement amount is routed through payroll as a taxable earning component.
