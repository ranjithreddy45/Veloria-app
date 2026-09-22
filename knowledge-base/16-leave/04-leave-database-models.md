# 04 Leave Database Models & Schema

## Core Schema Models (`prisma/schema.prisma`)

### 1. `LeaveType`
- `id`, `code` (CL, SL, EL, LOP), `name`, `paid` (boolean), `accrualPerYear`, `carryForwardMax`, `allowHalfDay`, `allowNegative`, `requiresApproval`, `isActive`.

---

### 2. `LeaveBalance`
- `id`, `employeeId`, `leaveTypeId`, `year`.
- `entitled`: Annual entitlement credit.
- `carriedForward`: Balance brought forward.
- `used`: Approved leave days consumed.
- `pending`: Applied leave awaiting approval.
- Compound unique constraint: `@@unique([employeeId, leaveTypeId, year])`.

---

### 3. `LeaveRequest`
- `id`, `employeeId`, `leaveTypeId`, `startDate`, `endDate`, `startPart`, `endPart`, `days`, `reason`, `status` (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`), `approverId`, `decidedAt`, `appliedOnTime`.

---

### 4. `CompOff`
- `id`, `employeeId`, `workDate`, `daysGranted`, `status` (`PENDING`, `APPROVED`, `REJECTED`), `approvedById`.
