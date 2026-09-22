# 14 Rejection, Resubmission & Needs Info Workflows

`CODE VERIFIED`

## Exception Handling Workflows

- **Rejection (`decideReimbursement(id, { decision: 'REJECTED' })`)**:
  - Sets `status: REJECTED`, records decision note, logs `HrClaimEvent` (`REJECTED`), and notifies employee.
- **Info Requested (`requestClaimInfo(claimId, note)`)**:
  - Approver changes claim status to `NEEDS_INFO`.
  - Employee receives notification and can update details/attachments.
- **Resubmission (`resubmitClaim(claimId, input)`)**:
  - Employee submits edits -> Status changes to `PENDING` (re-initiating Level 1 approval).
