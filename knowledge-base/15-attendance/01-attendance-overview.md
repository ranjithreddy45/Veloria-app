# 01 Attendance Subsystem Overview

## Executive Summary

The **Attendance Subsystem** in Veloria Grand provides geofenced time-tracking, mobile and web check-in/check-out, attendance regularization workflows, monthly muster sheet calculations, and downstream loss-of-pay (LOP) inputs into the payroll engine.

---

## High-Level Architectural Flow

```
[ Employee Check-In (Web/Mobile) ]
              │
              ▼
[ Geofence & IP Verification (AttendanceSite) ]
              │
              ▼
[ Daily Attendance Record (AttendanceRecord) ]
              │
              ▼
[ Monthly Attendance Aggregator (generateAttendanceSheet) ]
              │
              ▼
[ Loss of Pay (lopDays) Calculation ]
              │
              ▼
[ Downstream Payroll Engine (computePayslip with 30-Day Fixed Standard) ]
```

---

## Implementation Status Summary

| Area | Status | Key Files / Schema Models |
| :--- | :--- | :--- |
| **Attendance Records** | `CODE VERIFIED` | `AttendanceRecord`, `src/actions/hr-attendance.actions.ts` |
| **Attendance Sites & Geofencing**| `CODE VERIFIED` | `AttendanceSite`, `locationVerified`, `radiusMeters` |
| **Attendance Regularization** | `CODE VERIFIED` | `Regularization`, `requestRegularization`, `decideRegularization` |
| **Monthly Attendance Sheet** | `CODE VERIFIED` | `MonthlyAttendanceSheet`, `generateAttendanceSheet` |
| **Fixed 30-Day Payroll Standard**| `CODE VERIFIED` | `computePayslip` (`payableDays: 30`, `monthDays: 30`) |
| **Biometric Hardware Sync** | `PARTIALLY IMPLEMENTED` | `AttendanceSource.BIOMETRIC` supported in enum; hardware API unlinked |
