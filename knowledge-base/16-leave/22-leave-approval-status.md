# 22 Approval Decisions (`decideLeave`)

## Action: `decideLeave` (`src/actions/hr-leave.actions.ts`)

Executes manager/HR decision (`APPROVED` or `REJECTED`), updates `decidedAt`, records `decisionNote`, and updates `LeaveBalance` atomically.
