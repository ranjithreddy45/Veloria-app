# 27 Payroll Financial Integration

## Execution Flow

```
[ HR Payroll Run (hr-payroll-run.actions.ts) ]
               │
               ▼
[ Calculate Gross, PF, ESI, TDS, Net Salary ]
               │
               ▼
[ Post Payroll GL Action (finance-payroll.actions.ts) ]
               │
               ▼
[ FinJournalEntry Created (Dr 5060 Expense, Cr 2100 Payable, Cr 2200 Statutory) ]
```
