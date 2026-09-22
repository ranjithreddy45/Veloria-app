# 08 Leave Policy & Provisioning

## Balance Provisioning Engine (`provisionLeaveBalances`)

Provisions annual `LeaveBalance` rows per active employee for the target financial year. Computes `entitled = leaveType.accrualPerYear` and handles carried forward balances up to `carryForwardMax`.
