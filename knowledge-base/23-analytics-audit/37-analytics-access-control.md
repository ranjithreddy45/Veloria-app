# 37 Analytics Access Control & Role Scoping

`CODE VERIFIED`

## RBAC Permissions Matrix for Analytics

| System Role | Financial BI | HR Reports | Sales Analytics | Activity Log |
| :--- | :--- | :--- | :--- | :--- |
| `SUPER_ADMIN` | `FULL` | `FULL` | `FULL` | `FULL` |
| `FINANCE` | `FULL` | `PAYROLL ONLY` | `READ (REVENUE)` | `READ` |
| `HR_MANAGER` | `NO ACCESS` | `FULL` | `NO ACCESS` | `READ (HR)` |
| `SALES_HEAD` | `NO ACCESS` | `NO ACCESS` | `FULL` | `NO ACCESS` |
