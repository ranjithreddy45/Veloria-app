# 35 Dedicated Audit: Leave & Fixed 30-Day Payroll Matrix

## Dedicated Audit Matrix

### Leave Type & Payroll Deduction Matrix

| Leave Scenario | `leaveType.paid` | `MonthlyAttendanceSheet.leaveDays` | `lopDays` | Payroll `paidDays` (out of 30) | Salary Impact |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **0 Leave (Full Attendance)** | N/A | 0 | 0 | 30 | **100% Full Gross** |
| **1 Day Paid Leave (CL/SL/EL)** | `true` | +1.0 | 0 | 30 | **100% Full Gross** |
| **5 Days Paid Leave (CL/SL/EL)**| `true` | +5.0 | 0 | 30 | **100% Full Gross** |
| **1 Day Unpaid Leave (LOP)** | `false` | 0 | +1.0 | 29 | **Deducts 1/30th Gross** |
| **5 Days Unpaid Leave (LOP)** | `false` | 0 | +5.0 | 25 | **Deducts 5/30th Gross** |
| **Pending Leave Application** | N/A | 0 | 0 (if present) | 30 | No impact until approved |
| **Rejected Leave Application** | N/A | 0 | +1.0 (if absent) | 29 | Becomes LOP if absent |
| **Cancelled Approved Leave** | N/A | -1.0 | Restored | Restored | Restores original state |
