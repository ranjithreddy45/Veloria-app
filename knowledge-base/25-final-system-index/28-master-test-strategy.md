# Phase 28: Master Test Strategy

## 1. Automated Test Boundaries
- **Unit Testing**: Focus on pricing calculations (`src/lib/sales/pricing.ts`), double-entry GL balance verification (`src/lib/finance/journal.ts`), and fixed 30-day payroll formulas (`src/lib/hr/payroll-calc.ts`).
- **Integration Testing**: Test Server Actions against PostgreSQL test database using Prisma transactions.
- **API Endpoint Testing**: Verify HTTP status codes, authorization guards, and JSON response schemas for `/api/*` endpoints.

## 2. E2E Test Workflows
1. Lead Creation -> Quote Generation -> Public Acceptance -> Contract Signature -> Booking Lock -> BEO Approval -> Invoice -> Razorpay Webhook -> GL Posting.
2. Employee Onboarding -> Biometric Log Sync -> Leave Approval -> Payroll Execution -> Payslip Generation -> GL Salary Posting.
