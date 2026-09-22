# 07 Employee Status Lifecycle

## Status Transition Flow (`EmployeeStatus` Enum)

```
[ Candidate Hired ] ──► [ ONBOARDING ] ──► [ ACTIVE ] ──► [ ON_LEAVE ]
                                             │
                                             ├────────► [ SUSPENDED ]
                                             │
                                             └────────► [ EXITED ]
```

---

## Status Definitions

- `ONBOARDING`: Newly created employee record awaiting document verification.
- `ACTIVE`: Fully active employee eligible for attendance, payroll, and tasks.
- `ON_LEAVE`: Temporarily on extended leave.
- `SUSPENDED`: Account suspended; system login blocked.
- `EXITED`: Offboarded staff member; access revoked, soft-deleted.
