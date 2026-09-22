# 04 Attendance Database Models & Schema

## Core Schema Models (`prisma/schema.prisma`)

### 1. `AttendanceRecord`
- `id`: CUID PK.
- `employeeId`: Foreign key to `Employee.id`.
- `date`: UTC midnight date.
- `checkInAt`, `checkOutAt`: Timestamps.
- `checkInLat`, `checkInLng`, `checkInAccuracyM`: Check-in GPS parameters.
- `checkOutLat`, `checkOutLng`, `checkOutAccuracyM`: Check-out GPS parameters.
- `siteId`: Assigned `AttendanceSite.id`.
- `source`: `AttendanceSource` (`WEB`, `MOBILE`, `BIOMETRIC`, `MANUAL`).
- `status`: `AttendanceStatus` (`PRESENT`, `ABSENT`, `HALF_DAY`, `WFH`, `ON_LEAVE`, `HOLIDAY`, `WEEKEND`).
- `workedMinutes`: Integer.
- `locationVerified`: Boolean.
- `flagged`, `flagReason`: Anomaly tracking.

---

### 2. `MonthlyAttendanceSheet`
- `id`: CUID PK.
- `entityId`, `fy`, `month`, `employeeId`: Compound unique key.
- `workingDays`: Integer (calendar working days).
- `presentDays`: Decimal.
- `leaveDays`: Decimal (approved paid leave).
- `lopDays`: Decimal (Loss of Pay).
- `status`: `DRAFT` | `FINAL`.
