# 33 Unpaid Leave (LOP) Impact

## Unpaid Leave Accounting

- `leaveType.paid = false` (or `code = "LOP"`).
- Approved unpaid leave is NOT added to `leaveDays`.
- Increases `lopDays` on `MonthlyAttendanceSheet`.
- Reduces payroll `paidDays = 30 - lopDays`, deducting `1/30th` of gross salary per LOP day.
