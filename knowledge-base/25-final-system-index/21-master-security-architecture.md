# Phase 21: Master Security Architecture

## 1. Multi-Layer Security Architecture
- **Authentication**: NextAuth.js v5 JWT sessions stored in HTTP-only `__Secure-authjs.session-token` cookies.
- **Authorization**: Granular RBAC (`requirePermission('PERM_NAME')`) enforced at Server Action and API Route boundaries.
- **Token Entropy**: Public access tokens (quote/contract/payment) generated using 256-bit cryptographically secure random bytes.
- **AWS S3 Storage Security**: Bucket configured with private access; files accessed exclusively via short-lived presigned URLs.
- **Payment Verification**: Mandatory HMAC-SHA256 signature calculation on Razorpay webhooks and payment callback endpoints.
