# 45 Finance Subsystem Dependency Map

## Cross-Module Dependency Matrix

```
[ Lead CRM / Booking ] ──► [ Quotation / Invoice ] ──► [ Receivables (AR) ] ──► [ GL Engine ]
                                                                                   ▲
[ Procurement / Vendor ] ──► [ Vendor Bill ] ───────► [ Payables (AP) ] ───────────┤
                                                                                   │
[ HR / Payroll ] ───────────► [ Salary Run ] ───────► [ Payroll Accrual ] ────────┤
                                                                                   │
[ Employee Claims ] ────────► [ Reimbursement ] ────► [ Expense Postings ] ────────┘
```
