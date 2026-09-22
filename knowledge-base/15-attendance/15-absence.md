# 15 Absence Processing & Unexcused Absences

## Absence Processing

- On working days with no `AttendanceRecord` and no approved `LeaveRequest`, the employee is considered absent.
- Aggregated in `generateAttendanceSheet` as `lopDays = workingDays - presentDays - leaveDays`.
