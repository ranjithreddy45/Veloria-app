# 65 Payroll Subsystem Dependency Map

## Dependency Diagram

```
[ Employee ] ──► [ HrSalaryStructure ] ──► [ computePayslip ] ──► [ HrPayslip ]
                                                  ▲                      │
[ Attendance Sheet ] ─────────────────────────────┘                      ▼
                                                                [ FinJournalEntry ]
```
