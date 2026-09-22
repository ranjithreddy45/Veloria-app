# 52 Recruitment RBAC

`CODE VERIFIED`

- Permissions enforced via `hasPermission(role, "recruit:read")` and `hasPermission(role, "recruit:write")`.
- `createEmployeeFromCandidate()` requires `hr:write` or `hr:admin`.
