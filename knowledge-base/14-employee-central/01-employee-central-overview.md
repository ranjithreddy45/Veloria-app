# 01 Employee Central Overview

## Executive Summary

The **Employee Central (Employee Master) Subsystem** in Veloria Grand serves as the single source of truth for all human resource records, organizational hierarchies, employment parameters, statutory details, document repositories, and downstream module integrations (Attendance, Leave, Payroll, Reimbursements, Recruitment, Assets, and RBAC).

---

## High-Level Architecture

```
[ Recruitment / Manual HR Input ]
               │
               ▼
[ Employee Master Record (prisma.employee) ]
  ├── User Account Link (User.employeeId / Employee.userId)
  ├── Department & Designation (Department / HrDesignation)
  ├── Reporting Hierarchy (reportingManagerId -> Employee)
  ├── Statutory & Banking (EmployeeStatutory / Bank details)
  └── Document Management (HrDocument / S3)
               │
               ▼
[ Downstream HR Modules ]
  ├── Attendance (AttendanceRecord / AttendanceSite)
  ├── Leave Management (LeaveBalance / LeaveRequest)
  ├── Payroll Engine (HrPayrollRun / HrPayslip)
  ├── Expense Reimbursements (HrReimbursementClaim)
  └── Performance & Journeys (AppraisalReview / EmployeeJourney)
```

---

## Implementation Status Summary

| Area | Status | Key Files / Schema Models |
| :--- | :--- | :--- |
| **Employee Master Model** | `CODE VERIFIED` | `Employee`, `src/actions/hr-employee.actions.ts` |
| **Department Master** | `CODE VERIFIED` | `Department`, `src/actions/hr-config.actions.ts` |
| **Designation Master** | `CODE VERIFIED` | `HrDesignation`, `src/actions/hr-config.actions.ts` |
| **User Account Link** | `CODE VERIFIED` | `Employee.userId` -> `User.id`, `linkEmployeeUser` |
| **Org Chart & Hierarchy** | `CODE VERIFIED` | `Employee.reportingManagerId`, `getOrgTree` |
| **Recruitment Handoff** | `CODE VERIFIED` | `createEmployeeFromCandidate` (`recruit-hire.actions.ts`) |
| **Employee Documents** | `CODE VERIFIED` | `HrDocument`, `src/actions/hr-documents.actions.ts` |
| **Statutory & Banking** | `CODE VERIFIED` | `EmployeeStatutory`, `src/actions/hr-statutory.actions.ts` |
| **Automated Offboarding Clearance** | `PARTIALLY IMPLEMENTED` | Status changes to `EXITED`, manual clearance tracking |
