# 02 Attendance Business Purpose & Objectives

## Core Business Objectives

1. **Geofenced Time Tracking**: Ensures venue staff check in within designated physical venue radiuses (`AttendanceSite`).
2. **Attendance Regularization**: Allows employees to request correction for missed punches or field duties with manager sign-off.
3. **Automated LOP Computation**: Derives Loss-of-Pay days (`lopDays`) by comparing working days against present days and approved paid leave.
4. **Fixed 30-Day Payroll Integration**: Feeds `lopDays` into the payroll engine using a standardized 30-day denominator for consistent salary calculations.
