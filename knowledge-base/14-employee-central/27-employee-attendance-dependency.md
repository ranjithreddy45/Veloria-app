# 27 Employee to Attendance Dependency

## Cross-Module Bridge

`AttendanceRecord.employeeId` references `Employee.id`. Geofenced check-ins validate against `Employee.siteIds`.
