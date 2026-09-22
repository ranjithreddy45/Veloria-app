# 23 Leave Cancellation & Balance Restoration

## Action: `cancelLeave` (`src/actions/hr-leave.actions.ts`)

Allows an employee or manager to cancel a request. If approved, `used` is decremented; if pending, `pending` is decremented, restoring available balance.
