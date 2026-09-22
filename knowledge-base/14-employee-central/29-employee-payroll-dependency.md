# 29 Employee to Payroll Dependency

## Cross-Module Bridge

`HrPayslip.employeeId` links to `Employee.id`. Gross/Net calculations utilize `HrSalaryStructure` and `EmployeeStatutory`.
