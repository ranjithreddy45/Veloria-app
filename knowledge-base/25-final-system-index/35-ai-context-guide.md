# Phase 35: AI Context Guide

## Mandatory Invariants for AI Agents
1. **Financial Integrity**: Never modify financial logic without ensuring double-entry balance (`SUM(debit) == SUM(credit)`).
2. **Payroll Denominator**: Never change payroll calculations away from the fixed 30-day denominator (`dailyRate = baseSalary / 30.0`).
3. **BEO Immutability**: Respect `isLocked = true` on BEO models; do not bypass read-only locks.
4. **Portal Isolation**: Client and Vendor portal routes must validate session ownership (`clientId` or `vendorId`).
5. **No DB Push in Production**: Never use `npx prisma db push` for production schema updates; generate explicit SQL migrations.
6. **No Phantom Code**: Do not claim a feature exists unless verified by actual source files in `/src`.
