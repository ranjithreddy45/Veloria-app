# 47 Attendance Dependency Map

## Dependency Diagram

```
[ Employee ] ──► [ AttendanceSite ] ──► [ AttendanceRecord ]
                                               │
                                               ▼
[ Leave ] ────────► [ MonthlyAttendanceSheet ] ──► [ Payroll Engine ]
```
