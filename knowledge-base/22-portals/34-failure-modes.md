# 34 Failure Modes & Error Recovery

`CODE VERIFIED`

## Error Handling Specifications

- **Expired Token**: Redirects user to `/error?code=TOKEN_EXPIRED` with prompt to request a new link.
- **Revoked Link**: Displays "This link has been deactivated by the organizer".
- **Payment Verification Failure**: Retain `Payment` record in `FAILED` status, display retry button in checkout modal.
- **S3 Presigned URL Timeout**: Client receives `403 Forbidden`, triggers automatic token refresh request from client component.
