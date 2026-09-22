# 28 Security, Auth & Access Audit

`CODE VERIFIED`

## Security Audit Logging

- **Failed Logins**: Monitored via `/api/auth/[...nextauth]` callbacks, logging IP address and timestamp.
- **2FA Challenge Audits**: Records 2FA challenges (`UserTwoFactorChallenge`) and verification attempts.
- **Permission Changes**: Updates to role permissions (`rbac.actions.ts`) write immediately to `ActivityLog`.
- **API Key Audits**: API key creation, revocation, and push API requests logged in `PushApiRequestLog`.
