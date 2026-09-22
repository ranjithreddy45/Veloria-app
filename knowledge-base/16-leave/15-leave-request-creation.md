# 15 Leave Request Creation (`applyLeave`)

## Action: `applyLeave` (`src/actions/hr-leave.actions.ts`)

1. Validates inputs (`leaveTypeId`, `startDate`, `endDate`, `startPart`, `endPart`, `reason`).
2. Calculates requested working days (excluding weekends and holidays).
3. Checks available leave balance.
4. Identifies reporting manager (`Employee.reportingManagerId`) for `approverId`.
5. Creates `LeaveRequest` record in `PENDING` status.
