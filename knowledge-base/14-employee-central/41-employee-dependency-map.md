# 41 Employee Subsystem Dependency Map

## Cross-Module Dependency Diagram

```
[ Candidate ] ──► [ Employee Master ] ──► [ User Account ] ──► [ RBAC ]
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
  [ Attendance ]     [ Leave ]       [ Payroll ]
```
