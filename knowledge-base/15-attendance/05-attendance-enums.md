# 05 Attendance Enums & Status Codes

## Enum Definitions

### `AttendanceStatus`
- `PRESENT`: Full day present (1.0 day).
- `ABSENT`: Full day absent (0.0 day).
- `HALF_DAY`: Half day present (0.5 day).
- `WFH`: Work From Home (1.0 day).
- `ON_LEAVE`: Approved leave.
- `HOLIDAY`: Organization holiday.
- `WEEKEND`: Scheduled weekly off.

---

### `AttendanceSource`
- `WEB`: Browser portal punch.
- `MOBILE`: Mobile app punch (Capacitor).
- `BIOMETRIC`: Biometric terminal punch.
- `MANUAL`: HR/Manager manual punch.
