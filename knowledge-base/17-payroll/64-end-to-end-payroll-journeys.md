# 64 End-to-End Payroll Journeys

## Journey 1: Monthly Attendance to Salary Disbursement & GL Posting

```
[ Attendance Sheet (lopDays = 2) ] ──► [ computePayrollRun (paidDays = 28) ]
                                                   │
                                                   ▼
[ GL Journal Entry Posted (5060 / 2100) ] ◄── [ Disburse Bank Payment ]
```
