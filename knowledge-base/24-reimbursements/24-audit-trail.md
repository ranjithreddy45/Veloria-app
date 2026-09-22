# 24 Comprehensive Audit Trail & Event Logging

`CODE VERIFIED`

## Audit Trail Models (`HrClaimEvent` & `ActivityLog`)

- Every lifecycle change generates an immutable `HrClaimEvent` record capturing `action`, `fromStatus`, `toStatus`, `actorId`, `actorName`, and `note`.
- System changes log to global `ActivityLog` (`REIMBURSEMENT_SUBMITTED`, `REIMBURSEMENT_APPROVED`, `REIMBURSEMENT_REJECTED`, `REIMBURSEMENT_PAID`).
