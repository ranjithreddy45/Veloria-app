# 34 Financial Reporting Suite

## Standard Financial Reports (`src/lib/finance/reports.ts`)

1. **Trial Balance**: Lists all `FinAccount` balances, ensuring sum of Debits == sum of Credits.
2. **Profit & Loss (P&L)**: Aggregates Revenue (`4010`) minus Expenses (`5010`-`5230`).
3. **Balance Sheet**: Presents Assets (`1010`-`1300`) vs Liabilities (`2010`-`2230`) & Equity.
4. **Tally XML Export**: Formats transactions for seamless Tally ERP 9 / Tally Prime ingestion (`src/lib/finance/tally-xml.ts`).
