# 12 Late Arrival Detection & Flagging

## Late Arrival Logic

- Compares `checkInAt` against assigned shift start time (`HrShift.startTime`).
- If check-in exceeds grace period (e.g. 15 minutes), `flagged = true` and `flagReason = "Late arrival"`.
- Managers review and clear flags via `clearAttendanceFlag`.
