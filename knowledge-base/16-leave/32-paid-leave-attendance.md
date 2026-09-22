# 32 Paid Leave Impact on Attendance & Salary

## Paid Leave Accounting

- `leaveType.paid = true`.
- Approved paid leave increments `MonthlyAttendanceSheet.leaveDays`.
- Prevents day from becoming LOP (`lopDays = workingDays - presentDays - leaveDays`).
- Protects salary: 0 LOP = 30/30 paid days -> 100% salary paid.
