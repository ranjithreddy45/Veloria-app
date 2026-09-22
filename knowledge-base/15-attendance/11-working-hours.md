# 11 Working Hours & Duration Calculations

## Work Duration Logic

- Duration is tracked in `workedMinutes`.
- Standard full-day requirement is defined in `HrAttendancePolicy` (e.g. 480 minutes / 8 hours).
- Worked minutes below half-day threshold trigger `HALF_DAY` classification or manager flagging.
