# 06 Employee to Leave Relationship

## Employee Binding

- `LeaveRequest.employeeId` references `Employee.id`.
- `LeaveBalance.employeeId` references `Employee.id`.
- `LeaveRequest.approverId` references `Employee.id` (manager/approver).
- Only employees with status `ACTIVE` or `ONBOARDING` are provisioned leave balances.
