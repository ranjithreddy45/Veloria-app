# 34 HR & Employee Permission Registry

## Server Action Permissions

- `createEmployee`: Requires `hr.employees.create`.
- `updateEmployee`: Requires `hr.employees.update`.
- `archiveEmployee`: Requires `hr.employees.delete`.
- Checked via `hasPermission(session.user, permission)`.
