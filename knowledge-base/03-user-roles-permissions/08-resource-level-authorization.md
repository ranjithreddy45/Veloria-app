# Resource-Level Authorization & Scoping

## Overview

In Veloria Grand, role-based authorization is complemented by resource-level authorization (record scoping) to ensure users can only access data belonging to their department, organization, vendor ID, client ID, or employee record.

---

## Scoping Criteria & Mechanisms

### 1. User / Employee Self-Ownership (`userId`, `employeeId`)
- **Rule**: Non-admin staff and employees can view/edit only their own profile, attendance, leave requests, and reimbursements.
- **Enforcement**: In Server Actions, `session.user.id` or `session.user.employeeId` is matched against `targetRecord.employeeId`.
- **Code Location**: `src/lib/actions/reimbursement.ts`, `src/lib/actions/leave.ts`.
- **Failure Behavior**: Throws `"Unauthorized: You can only access your own records"`.

### 2. Client Portal Scoping (`clientId`)
- **Rule**: Users with role `CLIENT` can access bookings, invoices, quotations, and communications associated strictly with their assigned `clientId`.
- **Enforcement**: Database queries unconditionally append `WHERE clientId = session.user.clientId`.
- **Code Location**: `src/lib/actions/client-portal.ts`, `src/app/api/portal/client/...`.
- **Failure Behavior**: Returns empty results or `403 Forbidden`.

### 3. Vendor Portal Scoping (`vendorId`)
- **Rule**: Users with role `VENDOR` can view purchase orders, submit bids, and upload invoices scoped strictly to `vendorId`.
- **Enforcement**: `WHERE vendorId = session.user.vendorId`.
- **Code Location**: `src/lib/actions/vendor-portal.ts`, `src/app/api/portal/vendor/...`.
- **Failure Behavior**: Throws `"Access Denied: Unassigned Vendor"`.

### 4. Department Scoping (`departmentId`)
- **Rule**: Department heads (e.g., `HR_MANAGER`, `SALES_HEAD`, `OPERATIONS_HEAD`, `PROJECTS_HEAD`, `DESIGN_HEAD`) can manage records belonging to their department.
- **Enforcement**: Server Actions verify target employee's `departmentId` against manager's department or direct reports.
- **Code Location**: `src/lib/actions/employee.ts`, `src/lib/actions/department.ts`.
- **Failure Behavior**: Throws `"Forbidden: Cross-department modification restricted"`.

### 5. Approver Scoping (`approverId` / `managerId`)
- **Rule**: Approval actions require the acting user to match the assigned approver or possess overarching role authority (`FINANCE`, `SUPER_ADMIN`).
- **Enforcement**: Checks `record.nextApproverId === session.user.id` OR `session.user.role IN (SUPER_ADMIN, ADMIN)`.
- **Code Location**: `src/lib/actions/approval.ts`.
- **Failure Behavior**: Throws `"Not authorized to approve this request"`.

---

## Summary Table

| Resource | Scoping Key | Allowed Roles | Bypass Roles | Failure Action |
|---|---|---|---|---|
| Employee Profile / Self Data | `employeeId` | Record Owner | `SUPER_ADMIN`, `ADMIN`, `HR_MANAGER` | Throw Error / 403 |
| Client Bookings & Invoices | `clientId` | `CLIENT` | `SUPER_ADMIN`, `ADMIN`, `SALES_EXEC` | Filter Results / 403 |
| Vendor POs & Quotes | `vendorId` | `VENDOR` | `SUPER_ADMIN`, `ADMIN`, `OPERATIONS` | Filter Results / 403 |
| Department Leave Requests | `departmentId` | Department Head / Manager | `SUPER_ADMIN`, `ADMIN`, `HR_MANAGER` | Throw Error |
| Approval State Transition | `approverId` | Assigned Approver | `SUPER_ADMIN`, `ADMIN` | Throw Error |
