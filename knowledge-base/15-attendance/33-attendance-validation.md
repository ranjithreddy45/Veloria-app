# 33 Attendance Validation Rules

## Enforced Rules

1. Only one `AttendanceRecord` per employee per UTC date (`@@unique([employeeId, date])`).
2. Cannot check out without an active check-in.
3. Geofenced check-ins fail if outside `radiusMeters` (unless WFH allowed).
