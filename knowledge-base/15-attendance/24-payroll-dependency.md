# 24 Attendance to Payroll Dependency

## Data Handoff

`computePayrollRun` reads `MonthlyAttendanceSheet.lopDays` for each active employee and passes it directly to `computePayslip`.
