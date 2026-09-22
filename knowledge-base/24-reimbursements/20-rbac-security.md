# 20 RBAC, Permissions & IDOR Security Audit

`CODE VERIFIED`

## Security Scoping & IDOR Protections

- **Employee Scoping**: `listMyReimbursements()` queries strictly by `employeeId: me.id`.
- **Approver Scoping**: `decideReimbursement()` validates caller ID against `resolveClaimApprovers()` for current claim level before accepting decision.
- **Attachment Access**: `getClaimAttachment()` verifies caller is claim owner or has `hr:payroll` permission.
