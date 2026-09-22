# Phase 17: Master HR Flow

```mermaid
graph TD
    REC[Recruitment Pipeline] --> APP[Applicant Offer Accepted]
    APP --> EMP[Employee Master Record Created]
    EMP --> ATT[Attendance Log Sync & Manual Entry]
    EMP --> LEA[Leave Request & LOP Calculation]
    ATT --> PAY[Monthly Fixed 30-Day Payroll Engine]
    LEA --> PAY
    PAY --> SLIP[Payslip Generation & S3 Storage]
    PAY --> GL[General Ledger Payroll Posting]
```

## Fixed 30-Day Denominator Rule
- Salary calculation formula: `paidDays = 30 - LOP`.
- `dailyRate = monthlyBaseSalary / 30.0`.
- Working days count in calendar month does not alter the fixed 30-day denominator.
