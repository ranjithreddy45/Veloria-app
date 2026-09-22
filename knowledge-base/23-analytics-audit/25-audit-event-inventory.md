# 25 Audit Event Inventory

`CODE VERIFIED`

## Audited System Events Directory

| Event Category | Action String | Entity Type | Metadata Captured | Immutability |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication** | `USER_SIGNIN_SUCCESS` | `User` | IP, User-Agent | `IMMUTABLE` |
| **Authentication** | `USER_SIGNIN_FAILED` | `User` | Attempted Email, IP | `IMMUTABLE` |
| **Contract** | `CONTRACT_SIGNED` | `Contract` | IP, User-Agent, Signature Hash | `IMMUTABLE` |
| **Finance** | `JOURNAL_ENTRY_POSTED` | `FinJournalEntry` | Line Items, User, Amounts | `IMMUTABLE` |
| **Finance** | `INVOICE_CANCELLED` | `Invoice` | Reason, Approver ID, Previous Total | `IMMUTABLE` |
| **Payroll** | `PAYROLL_RUN_APPROVED` | `HrPayrollRun` | Total Gross, Net, Employee Count | `IMMUTABLE` |
| **Payroll** | `SALARY_STRUCTURE_CHANGED`| `HrSalaryStructure`| Old Gross, New Gross, Approver | `IMMUTABLE` |
| **Attendance** | `ATTENDANCE_REGULARIZED` | `AttendanceRecord` | Original Punch, Approved Punch, Reason | `IMMUTABLE` |
| **Security** | `ROLE_PERMISSIONS_UPDATED` | `RolePermission` | Role Name, Added/Removed Permissions | `IMMUTABLE` |
