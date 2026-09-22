# 26 Attendance to Payroll Pipeline

## Pipeline Bridge

`computePayrollRun` queries `MonthlyAttendanceSheet` by `employeeId`, passing `sheet.lop` into `computePayslip`.
