# Phase 34: Developer Change Guide

## Quick Start for Code Modifications
- **Modifying Lead Assignment Rules**: See `src/actions/lead.ts` -> Update `assignLead()` -> Run lead CRM tests.
- **Updating Invoice Tax Logic**: See `src/lib/sales/pricing.ts` & `src/actions/invoice.ts` -> Verify double-entry GL debit/credit balance.
- **Adjusting Payroll Formula**: See `src/lib/hr/payroll-calc.ts` -> Maintain fixed 30-day denominator (`paidDays = 30 - LOP`).
- **Adding New RBAC Role**: See `prisma/schema.prisma` -> Update `Role` enum & seed scripts -> Update `src/lib/auth/permissions.ts`.
- **Modifying BEO Read-Only Lock**: See `src/actions/beo.ts` -> Check `isLocked` guard before permitting field edits.
