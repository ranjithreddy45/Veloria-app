# 02 Finance Business Purpose & Objectives

## Core Business Objectives

The Veloria Grand Finance & General Ledger system fulfills five primary enterprise requirements:

1. **Accounting Integrity**: Enforces strict double-entry balance checks (`Sum(Debits) == Sum(Credits)`) across all automated and manual entries.
2. **Auditability & Traceability**: Links every financial line item back to its originating business source (`FinSourceModule`: `RECEIVABLE`, `PAYABLE`, `PAYROLL`, `BANK`, `ASSET`, `TAX`, `MANUAL`).
3. **Statutory Compliance**: Computes Indian GST (CGST, SGST, IGST) split based on venue location vs. customer state, supporting monthly GST returns and Tally ERP/Prime synchronizations.
4. **Financial Control & Period Locking**: Prevents backdated modifications or unposted entries in closed fiscal months (`FinPeriodStatus`: `OPEN`, `CLOSED`, `LOCKED`).
5. **Multi-Module Consolidation**: Unifies revenue, procurement expenses, staff payroll, employee reimbursements, and asset depreciation into standardized financial statements (Trial Balance, P&L, Balance Sheet, Cash Flow).

---

## Operational Scope & Boundaries

```
                 ┌──────────────────────────────────────┐
                 │        Veloria Grand ERP             │
                 └──────────────────┬───────────────────┘
                                    │
    ┌───────────────────────────────┼───────────────────────────────┐
    ▼                               ▼                               ▼
[ Sales & Billing ]         [ Vendor Procurement ]          [ Payroll & Expenses ]
 - Invoices Issued           - Goods Receipts                - Salary Accruals
 - Customer Payments         - Vendor Bills                  - Reimbursement Claims
 - Credit Notes              - Vendor Advances               - Statutory Deductions
    │                               │                               │
    └───────────────────────────────┼───────────────────────────────┘
                                    │
                                    ▼
                 ┌──────────────────────────────────────┐
                 │   General Ledger Engine (ledger.ts)   │
                 │  - Chart of Accounts (coa-seed.ts)   │
                 │  - Balanced Journal Line Validation  │
                 │  - Fiscal Period Control (FinPeriod)  │
                 └──────────────────┬───────────────────┘
                                    │
                                    ▼
                 ┌──────────────────────────────────────┐
                 │       Financial Reports & Exports    │
                 │  - Trial Balance / P&L / Bal Sheet   │
                 │  - GST Returns (GSTR-1, GSTR-3B)     │
                 │  - Tally XML Synchronizer            │
                 └──────────────────────────────────────┘
```
