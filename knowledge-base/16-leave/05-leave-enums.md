# 05 Leave Enums & Status Codes

## Enum Definitions

### `LeaveRequestStatus`
- `PENDING`: Application submitted, awaiting manager/HR decision.
- `APPROVED`: Application approved, balance deducted, attendance credited.
- `REJECTED`: Application rejected, reserved pending balance released.
- `CANCELLED`: Cancelled by applicant or HR, restoring leave balance.

---

### `HalfDayPart`
- `FULL`: Full day leave.
- `FIRST_HALF`: Morning session leave (0.5 day).
- `SECOND_HALF`: Afternoon session leave (0.5 day).
