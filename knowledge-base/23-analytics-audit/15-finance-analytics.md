# 15 Finance & General Ledger Analytics

`CODE VERIFIED`

## CFO Command Center Engine (`src/actions/finance-profitability.actions.ts`)

- **Trial Balance Engine**: Real-time balance check (`SUM(FinJournalLine.debitAmount) == SUM(FinJournalLine.creditAmount)`).
- **Profit & Loss (P&L)**: Real-time aggregation of Revenue accounts (`Income`) minus Expense accounts (`Expenses`).
- **Balance Sheet**: Assets = Liabilities + Equity.
- **Cash Flow Analytics**: Tracks operating cash inflows (customer payments) vs outflows (vendor payouts, payroll, capex).
