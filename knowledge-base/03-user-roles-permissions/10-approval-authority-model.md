# Approval Authority Model

## Overview

Veloria Grand enforces multi-tier approval workflows for financial, operational, HR, and sales transactions. Approval authority is distinct from standard CRUD permissions: having permission to `create` a quotation or reimbursement does **not** grant authority to `approve` it.

---

## Key Approval Workflows

### 1. Reimbursement & Expense Approvals
- **Levels**:
  - Level 1: Direct Manager / Department Head (`HR_MANAGER`, `SALES_HEAD`, `OPERATIONS_HEAD`, etc.)
  - Level 2: Finance Department (`FINANCE`, `ADMIN`, `SUPER_ADMIN`)
- **State Flow**: `PENDING_MANAGER` -> `PENDING_FINANCE` -> `APPROVED` / `REJECTED`
- **Code Reference**: `src/lib/actions/reimbursement.ts`

### 2. Quotation & Discount Approvals
- **Trigger**: Discount exceeds standard threshold (e.g., > 10%).
- **Approver**: `SALES_HEAD`, `ADMIN`, or `SUPER_ADMIN`.
- **State Flow**: `DRAFT` -> `PENDING_APPROVAL` -> `APPROVED` / `REJECTED`
- **Code Reference**: `src/lib/actions/quotation.ts`

### 3. Leave Request Approvals
- **Approver**: Direct Manager or `HR_MANAGER`.
- **State Flow**: `PENDING` -> `APPROVED` / `REJECTED`
- **Code Reference**: `src/lib/actions/leave.ts`

### 4. Purchase Order & Vendor Invoices
- **Approver**: `OPERATIONS_HEAD` or `FINANCE`.
- **State Flow**: `SUBMITTED` -> `APPROVED` -> `PAID`
- **Code Reference**: `src/lib/actions/procurement.ts`

---

## Approval Authorization Matrix

| Workflow | Initiator Roles | Level 1 Approver | Level 2 Approver | Database Log Model |
|---|---|---|---|---|
| Expense Reimbursement | All Employees | Manager / Dept Head | `FINANCE` | `ApprovalLog` |
| Quotation Special Pricing | `SALES_EXEC` | `SALES_HEAD` | `ADMIN` / `SUPER_ADMIN` | `QuotationApproval` |
| Employee Leave Request | Staff / Execs | Direct Manager | `HR_MANAGER` | `LeaveApproval` |
| Vendor Purchase Order | `OPERATIONS` | `OPERATIONS_HEAD` | `FINANCE` | `POApproval` |
| Contract Finalization | `SALES_EXEC` | `LEGAL` | `SUPER_ADMIN` | `ContractApproval` |
