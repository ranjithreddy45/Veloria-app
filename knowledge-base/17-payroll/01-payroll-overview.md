# 01 Payroll Subsystem Overview

## Executive Summary

The **Payroll Subsystem** in Veloria Grand serves as the computational engine for salary calculations, statutory deductions (PF, ESI, PT, TDS, LWF), Loss-of-Pay (LOP) deductions under a fixed 30-day standard, advance recoveries, payslip generation, and General Ledger (GL) journal postings.

---

## High-Level Architecture Flow

```
[ Active Employee Master & Structure (HrSalaryStructure) ]
                           │
                           ▼
[ Monthly Attendance Aggregator (MonthlyAttendanceSheet -> lopDays) ]
                           │
                           ▼
[ Pure Calculation Engine (computePayslip in payroll-calc.ts) ]
   ├── Fixed 30-day denominator (payableDays = 30)
   ├── Paid days = 30 - lopDays
   ├── Pro-rated earnings = monthly * (paidDays / 30)
   └── Statutory Math (PF, ESI, PT, TDS)
                           │
                           ▼
[ Payroll Run & Payslips (HrPayrollRun & HrPayslip) ]
                           │
                           ▼
[ Finance General Ledger Posting (postPayrollRun -> FinJournalEntry) ]
   ├── Dr Salaries Expense (5060 / 5100)
   └── Cr Salaries Payable (2100 / 2230) & Statutory Liabilities (PF, ESI, PT, TDS)
```

---

## Implementation Status Summary

| Area | Status | Key Components / File Paths |
| :--- | :--- | :--- |
| **Salary Structure Builder** | `CODE VERIFIED` | `buildStructureLines`, `HrSalaryStructure` |
| **Pure Computation Engine** | `CODE VERIFIED` | `src/lib/hr/payroll-calc.ts` (`computePayslip`) |
| **Fixed 30-Day Standard** | `CODE VERIFIED` | `payableDays: 30`, `monthDays: 30` in `computePayslip` |
| **Payroll Run Execution** | `CODE VERIFIED` | `createPayrollRun`, `computePayrollRun` (`hr-payroll-run.actions.ts`) |
| **Payslip PDF Generator** | `CODE VERIFIED` | `src/app/api/hr/payslips/[id]/pdf/route.ts` |
| **Finance GL Journal Bridge**| `CODE VERIFIED` | `postPayrollRun` (`finance-payroll.actions.ts`) |
| **Statutory Online Filing** | `PARTIALLY IMPLEMENTED` | Calculations & exports verified; direct ESI/PF portal filing is `MANUAL VERIFICATION REQUIRED` |
