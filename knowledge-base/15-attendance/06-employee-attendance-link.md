# 06 Employee to Attendance Relationship

## Employee Binding

- `AttendanceRecord.employeeId` references `Employee.id`.
- `Employee.siteIds`: Array of authorized `AttendanceSite` IDs that an employee is permitted to punch from.
- `Employee.attendanceAllSites`: Boolean flag allowing punches from any active site.
