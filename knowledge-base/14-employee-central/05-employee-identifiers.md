# 05 Employee Identifiers & Security

## Identifiers Inventory

- `id`: Internal CUID primary key (`cuid()`).
- `empCode`: Unique external employee code (e.g. `EMP-001`), unique indexed.
- `userId`: Optional foreign key linking to authentication `User.id`.
- `PAN`, `Aadhaar`, `UAN`, `PF Number`, `ESI Number`: Encapsulated in `EmployeeStatutory` model for strict access control.
