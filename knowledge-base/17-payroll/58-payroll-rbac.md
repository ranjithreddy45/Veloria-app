# 58 Payroll RBAC & Permissions

## Permission Matrix

| Role | View Run | Compute Run | Post GL | Download Payslip |
| :--- | :---: | :---: | :---: | :---: |
| `SUPER_ADMIN` | Yes | Yes | Yes | Yes |
| `HR_MANAGER` | Yes | Yes | No | Yes |
| `FINANCE_HEAD` | Yes | Yes | Yes | Yes |
| `STAFF` | No | No | No | Own Payslip Only |
