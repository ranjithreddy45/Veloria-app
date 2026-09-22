# 03 Server Action Specifications

`CODE VERIFIED`

## Master List of Reimbursement Server Actions (`src/actions/hr-reimbursement.actions.ts`)

### 1. `submitReimbursement(input)`
- **Input**: `{ category, title, amount, claimDate, fuelLiters?, note?, files? }`
- **Validation**: Enforces 50L monthly fuel cap for `category === 'FUEL'`.
- **Operations**: Creates `HrReimbursementClaim` (`status: PENDING`), stores `HrClaimAttachment` records, creates `HrClaimEvent` (`SUBMITTED`), dispatches notifications to Level 1 approvers.

### 2. `decideReimbursement(id, input)`
- **Input**: `id`, `{ decision: 'APPROVED' | 'REJECTED', note? }`
- **Authorization**: Verifies caller is in resolved approver list for current level (`level1`, `level2`, or `level3`) or is `SUPER_ADMIN`.
- **State Transition**:
  - `PENDING` (L1 Approved) -> `PENDING_L2` (or auto-advances to `APPROVED` if no L2 rule).
  - `PENDING_L2` (L2 Approved) -> `APPROVED`.
  - `REJECTED` -> Sets `status: REJECTED` and notifies employee.

### 3. `markReimbursementPaid(id, input)`
- **Input**: `id`, `{ paymentRef, paymentDate? }`
- **Authorization**: Requires `FINANCE`, `ADMIN`, or `SUPER_ADMIN` role.
- **Operations**: Sets `status: PAID`, records `paymentRef` and `paidAt`, creates `HrClaimEvent` (`PAID`), updates GL journal.

### 4. `scheduleReimbursementPayment(id, input)`
- **Input**: `id`, `{ payFy, payMonth }`
- **Operations**: Links claim to specific payroll run period (`payFy`, `payMonth`) for inclusion in monthly payslips.
