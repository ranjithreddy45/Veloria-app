# 18 Overlapping Leave Prevention

## Validation Guard

`applyLeave` queries existing `LeaveRequest` records for the employee where status is `PENDING` or `APPROVED` and date ranges overlap, throwing an error if overlap is detected.
