# 19 Attendance Regularization Workflow

## Regularization Engine (`Regularization`)

1. Employee submits request (`requestRegularization`) specifying date, reason, and requested check-in/out times.
2. Creates `Regularization` record with status `PENDING`.
3. Manager approves or rejects (`decideRegularization`).
4. Upon approval, `AttendanceRecord` is updated and `isRegularized = true`.
