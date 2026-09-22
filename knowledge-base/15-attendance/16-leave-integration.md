# 16 Leave System Integration

## Attendance-Leave Bridge

- `generateAttendanceSheet` queries approved paid `LeaveRequest` records for the month.
- Adds working days covered by leave to `leaveDays`.
- Paid leave prevents absence from becoming Loss of Pay (`lopDays`).
