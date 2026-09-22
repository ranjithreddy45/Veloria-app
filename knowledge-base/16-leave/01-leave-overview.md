# 01 Leave Management Subsystem Overview

## Executive Summary

The **Leave Management Subsystem** in Veloria Grand provides automated leave entitlement provisioning, multi-type leave balance tracking (Casual, Sick, Earned, Comp-Off, LOP), half-day and full-day leave requests, manager approval queues, leave calendar visualization, and seamless integration with Monthly Attendance Sheets and Payroll processing.

---

## High-Level Architectural Flow

```
[ Leave Types & Entitlements (LeaveType / LeaveBalance) ]
                           │
                           ▼
[ Leave Application (applyLeave - LeaveRequest PENDING) ]
                           │
                           ▼
[ Manager / HR Approval (decideLeave -> APPROVED) ]
                           │
                           ▼
[ Balance Update (LeaveBalance.used += days, pending -= days) ]
                           │
                           ▼
[ Monthly Attendance Aggregator (generateAttendanceSheet -> leaveDays) ]
                           │
                           ▼
[ Loss of Pay (lopDays = workingDays - presentDays - leaveDays) ]
                           │
                           ▼
[ Downstream Payroll (computePayslip: paidDays = 30 - lopDays) ]
```

---

## Implementation Status Summary

| Area | Status | Key Components / File Paths |
| :--- | :--- | :--- |
| **Leave Types Master** | `CODE VERIFIED` | `LeaveType`, `src/actions/hr-leave.actions.ts` |
| **Leave Balance Tracking** | `CODE VERIFIED` | `LeaveBalance`, `provisionLeaveBalances` |
| **Leave Application Engine** | `CODE VERIFIED` | `applyLeave`, `LeaveRequest` |
| **Manager Approval Queue** | `CODE VERIFIED` | `getLeaveApprovalQueue`, `decideLeave` |
| **Attendance Bridge** | `CODE VERIFIED` | `generateAttendanceSheet` (reads `LeaveRequest.status == "APPROVED"`) |
| **Payroll LOP Bridge** | `CODE VERIFIED` | Unpaid leave increases `lopDays`, reducing payroll `paidDays` from 30 |
| **Automated Accrual Cron** | `PARTIALLY IMPLEMENTED` | Annual entitlement provisioned; monthly accrual cron is `MANUAL VERIFICATION REQUIRED` |
