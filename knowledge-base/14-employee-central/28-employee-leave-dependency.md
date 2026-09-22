# 28 Employee to Leave Dependency

## Cross-Module Bridge

`LeaveRequest` and `LeaveBalance` link to `Employee.id`. Approvals route automatically to `Employee.reportingManagerId`.
