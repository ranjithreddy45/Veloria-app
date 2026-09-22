# Phase 36: Architectural Invariants

## Core Invariants
1. **Double-Entry General Ledger Balance**: All GL transactions must have matching debit and credit totals.
2. **Immutable Posted Journals**: Posted journal entries (`isPosted = true`) can never be updated or deleted; reversals must be posted.
3. **Fixed 30-Day Payroll Denominator**: Monthly salary calculations use `30` as the fixed denominator regardless of actual days in the calendar month.
4. **BEO Readiness & Read-Only Lock**: Locked BEOs (`isLocked = true`) reject all modifications.
5. **Server-Side Security Enforcement**: All authorization checks are executed on the server using `requirePermission()`.
6. **256-Bit Token Entropy**: Public links use 256-bit cryptographically generated tokens.
