# 21 Monthly Attendance Sheet Architecture

## Monthly Sheet Generation (`generateAttendanceSheet`)

Calculates monthly totals per active employee:
- `workingDays`: Total working days in month.
- `presentDays`: Sum of present and half-days.
- `leaveDays`: Approved paid leave days.
- `lopDays`: `Math.max(0, workingDays - presentDays - leaveDays)`.
