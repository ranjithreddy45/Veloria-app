# 09 Leave Eligibility & Validation Rules

## Eligibility Checks (`applyLeave`)

1. Employee must be active.
2. Available balance check: `(entitled + carriedForward - used - pending) >= requestedDays` (unless `allowNegative = true`).
3. Date span validation (working days computed excluding weekends and holidays).
4. Cutoff rule: Submissions on or before the 25th of the month are marked `appliedOnTime = true`; late submissions are marked `appliedOnTime = false`.
