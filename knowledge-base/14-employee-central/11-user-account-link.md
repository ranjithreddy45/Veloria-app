# 11 Employee to User Account Synchronization

## Synchronization Engine (`linkEmployeeUser`)

In `src/actions/hr-employee.actions.ts`:

- `linkEmployeeUser(employeeId, userId)`: Sets `Employee.userId = userId` and updates `User.employeeId = employeeId`.
- Enables single sign-on mapping where an authenticated `User` inherits their linked `Employee` profile attributes.
- Unlinking is supported via `unlinkEmployeeUser`.
