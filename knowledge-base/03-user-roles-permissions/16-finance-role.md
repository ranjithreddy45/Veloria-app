# Role Deep Dive: FINANCE

## Overview

`FINANCE` manages billing, invoices, payment processing, expense reimbursements, vendor payouts, and financial auditing.

---

## Role Profile

- **Exact Code Value**: `"FINANCE"`
- **Display Name**: Finance Executive / Manager
- **User Type**: Internal Finance Staff
- **Primary Function**: Invoicing, payment reconciliation, expense approval, financial reporting.

---

## Key Capabilities & Scoping

- **Permissions**: `finance:read`, `finance:write`, `invoices:create`, `invoices:edit`, `payments:record`, `reimbursements:approve`, `reports:finance`.
- **Approval Authority**: Level 2 final approval for expense reimbursements, vendor payout approval.
- **Restrictions**: Cannot modify system settings, HR employee salaries directly, or user roles.

---

## Code References

- `src/lib/actions/finance.ts`
- `src/lib/actions/invoice.ts`
- `src/lib/actions/reimbursement.ts`
