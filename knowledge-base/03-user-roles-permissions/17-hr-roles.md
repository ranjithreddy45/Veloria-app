# Role Family Deep Dive: HR Roles (HR_EXECUTIVE & HR_MANAGER)

## Overview

The HR role family handles employee lifecycle management, attendance tracking, leave requests, payroll processing, and recruitment.

---

## Role Profiles

### 1. HR_EXECUTIVE
- **Exact Code Value**: `"HR_EXECUTIVE"`
- **Function**: Maintain employee profiles, track daily attendance, process leave documentation, assist in recruitment.
- **Key Permissions**: `hr:read`, `employees:read`, `employees:create`, `attendance:manage`, `leave:read`.

### 2. HR_MANAGER
- **Exact Code Value**: `"HR_MANAGER"`
- **Function**: Oversee HR operations, approve leave requests, manage payroll cycles, approve reimbursements (Level 1), manage employee status.
- **Key Permissions**: Includes all `HR_EXECUTIVE` permissions plus `leave:approve`, `payroll:manage`, `employees:edit`, `employees:delete`, `reports:hr`.

---

## Code References

- `src/lib/actions/employee.ts`
- `src/lib/actions/leave.ts`
- `src/lib/actions/payroll.ts`
