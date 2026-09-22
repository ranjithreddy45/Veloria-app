# Phase 29: Master Security Test Matrix

| Attack Vector | Target Surface | Defense Mechanism | Test Approach |
|---|---|---|---|
| Authentication Bypass | Dashboard Routes | NextAuth Session & Edge Middleware | Attempt unauthenticated GET request to `/dashboard` |
| Privilege Escalation | Server Actions | `requirePermission()` Guard | Invoke `postJournalEntryAction` with `EMPLOYEE_USER` session |
| Token Guessing | `/q/[token]` Links | 256-bit Token Entropy | Brute-force random tokens against public quote endpoint |
| Razorpay Webhook Forgery | `/api/webhooks/razorpay` | HMAC-SHA256 Signature Verification | Send fake POST payload without valid signature header |
| S3 Asset Tampering | Contract PDFs | Short-Lived Presigned URLs | Attempt direct S3 bucket URL access without presigned token |
| SQL Injection | Search Filters | Prisma ORM Parameterized Queries | Inject SQL strings into search input fields |
| XSS / CSRF | Form Submissions | React automatic escaping & NextAuth CSRF | Submit malicious scripts in lead notes and BEO items |
