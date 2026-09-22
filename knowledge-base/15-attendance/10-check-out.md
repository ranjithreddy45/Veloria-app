# 10 Check-Out Workflow & Duration Calculation

## Action: `checkOut` (`src/actions/hr-attendance.actions.ts`)

1. Locates today's active `AttendanceRecord`.
2. Records `checkOutAt` timestamp, GPS coordinates, and accuracy.
3. Computes `workedMinutes = (checkOutAt - checkInAt) / 60000`.
4. Updates record with geo-verification results.
