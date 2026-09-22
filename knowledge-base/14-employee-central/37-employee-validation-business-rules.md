# 37 Employee Validation & Business Rules

## Enforced Business Rules

1. `empCode` must be unique across the organization.
2. `email` (if provided) must be unique.
3. Employee cannot be their own reporting manager.
4. Active employee cannot be deleted; must use soft-delete (`deletedAt`) or set status to `EXITED`.
