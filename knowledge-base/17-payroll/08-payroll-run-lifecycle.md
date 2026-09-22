# 08 Payroll Run Lifecycle & State Machine

## State Transition Flow

```
[ Create Run (DRAFT) ] ──► [ Compute Run (computePayrollRun) ] ──► [ Lock Run (LOCKED) ]
                                                                             │
                                                                             ▼
[ GL Journal Posted (FinJournalEntry) ] ◄── [ Disburse Bank Payment (PAID) ] ┘
```
