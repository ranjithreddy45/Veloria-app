# 13 Carry-Forward & Year-End Processing

## Carry-Forward Logic

`provisionLeaveBalances` evaluates `leaveType.carryForwardMax`. If `previousYearAvailable > 0`, `carriedForward = Math.min(previousYearAvailable, carryForwardMax)`.
