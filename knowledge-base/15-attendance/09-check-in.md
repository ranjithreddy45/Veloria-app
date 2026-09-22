# 09 Check-In Workflow & Server Action

## Action: `checkIn` (`src/actions/hr-attendance.actions.ts`)

1. Verifies authenticated user session.
2. Captures GPS coordinates, accuracy, IP address, and optional selfie URL.
3. Validates location against `AttendanceSite`.
4. Creates `AttendanceRecord` with status `PRESENT` (or `WFH` if off-site and WFH allowed).
5. Prevents duplicate check-in on the same date via `@@unique([employeeId, date])`.
