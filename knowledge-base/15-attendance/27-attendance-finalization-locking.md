# 27 Attendance Sheet Finalization & Locking

## Sheet Locking (`finalizeAttendanceSheet`)

- Changes `MonthlyAttendanceSheet.status` from `DRAFT` to `FINAL`.
- Finalized rows are locked against automated regeneration unless an explicit `force` parameter is passed.
