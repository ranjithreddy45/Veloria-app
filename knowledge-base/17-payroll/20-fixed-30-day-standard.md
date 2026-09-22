# 20 Fixed 30-Day Payroll Standard Audit

## Dedicated Audit: Fixed 30-Day Denominator

As established in code:
- `payableDays = 30` (fixed constant).
- `monthDays = 30` (fixed constant).
- `lopDays` from `MonthlyAttendanceSheet` is subtracted from 30.
- `paidDays = 30 - lopDays`.
- `payFactor = (30 - lopDays) / 30`.
