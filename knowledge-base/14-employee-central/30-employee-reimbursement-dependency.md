# 30 Employee to Reimbursement Dependency

## Cross-Module Bridge

`HrReimbursementClaim.employeeId` links to `Employee.id`. Multi-tier approvals route through manager -> HR -> Finance.
