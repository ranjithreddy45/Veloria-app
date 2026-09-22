# 21 Leave Approval Routing & Escalation

## Routing Logic

Requests automatically route to `Employee.reportingManagerId`. If `reportingManagerId` is null, HR Admins (`hr:payroll` permission) serve as default approvers.
