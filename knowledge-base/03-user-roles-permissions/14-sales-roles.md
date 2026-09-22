# Role Family Deep Dive: Sales Roles (SALES_EXEC & SALES_HEAD)

## Overview

The Sales family manages lead acquisition, pipeline tracking, client communication, quotation generation, and contract finalization.

---

## Role Profiles

### 1. SALES_EXEC
- **Exact Code Value**: `"SALES_EXEC"`
- **User Type**: Internal Field / Office Sales Staff
- **Primary Function**: Create and manage assigned leads, draft quotations, log client calls.
- **Scope**: Scoped to assigned leads (`lead.assignedToId == user.id`) or department visibility.
- **Key Permissions**: `leads:read`, `leads:create`, `leads:edit`, `quotations:read`, `quotations:create`, `contracts:read`.
- **Approval Authority**: Cannot approve discounts or final contracts.

### 2. SALES_HEAD
- **Exact Code Value**: `"SALES_HEAD"`
- **User Type**: Internal Sales Department Manager
- **Primary Function**: Manage sales team, reassign leads, approve custom quotation discounts, review pipeline performance.
- **Scope**: Department-wide visibility.
- **Key Permissions**: Includes all `SALES_EXEC` permissions plus `leads:delete`, `quotations:approve`, `reports:sales`, `sales:manage`.
- **Approval Authority**: Approves special pricing, custom quotation discounts, and contract terms.

---

## Code References

- `src/lib/actions/lead.ts`
- `src/lib/actions/quotation.ts`
