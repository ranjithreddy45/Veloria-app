# 31 Security & Vulnerability Review

`CODE VERIFIED`

## Security Audit Summary

1. **Authentication & Authorization**: Server Actions enforce `requireUser()` and check caller permissions (`can(role, 'hr:payroll')` or approver resolution).
2. **IDOR Prevention**: `getClaimAttachment()` and `cancelMyReimbursement()` verify employee ownership or HR permissions.
3. **MIME Type Validation**: Attachments restricted to images and PDFs.
