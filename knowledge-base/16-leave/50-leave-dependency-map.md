# 50 Leave Subsystem Dependency Map

## Dependency Diagram

```
[ Employee ] ──► [ LeaveType / LeaveBalance ] ──► [ LeaveRequest ]
                                                          │
                                                          ▼
[ Payroll Engine ] ◄── [ MonthlyAttendanceSheet ] ◄── [ Approval Engine ]
```
