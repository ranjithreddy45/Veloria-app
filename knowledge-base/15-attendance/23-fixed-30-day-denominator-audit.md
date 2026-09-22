# 23 Dedicated 30-Day Denominator & Payroll Audit

## Dedicated Audit: The Fixed 30-Day Payroll Standard

### Executive Discovery

Our code inspection reveals a deliberate architectural separation between **Upstream Attendance** and **Downstream Payroll**:

1. **Upstream Attendance (`generateAttendanceSheet`)**:
   Computes `workingDays` as calendar working days (e.g., 22 days in a 31-day month). It computes `lopDays = workingDays - presentDays - leaveDays`.

2. **Downstream Payroll (`computePayrollRun` & `computePayslip`)**:
   Explicitly enforces a **Fixed 30-Day Standard**:
   ```typescript
   // CODE VERIFIED: src/actions/hr-payroll-run.actions.ts
   const c = computePayslip({
     lines,
     lopDays: sheet?.lop ?? 0,
     payableDays: 30, // FIXED 30-DAY PAYROLL STANDARD
     monthDays: 30,
     ...
   });
   ```

3. **Payroll Daily Rate Math (`src/lib/hr/payroll-calc.ts`)**:
   ```typescript
   const base = input.payableDays && input.payableDays > 0 ? input.payableDays : monthDays; // base = 30
   const lopDays = Math.max(0, Math.min(input.lopDays ?? 0, base));
   const paidDays = base - lopDays; // 30 - lopDays
   const payFactor = base > 0 ? paidDays / base : 1; // (30 - lopDays) / 30
   ```

---

## 30-Day Conceptual Test Matrix

| Scenario | Calendar Month | LOP Days | Payable Base | Paid Days | Pay Factor | Salary Paid |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Full Attendance (31-day month)** | 31 Days | 0 | 30 | 30 | 30 / 30 = 1.00 | **100% Full Gross** |
| **Full Attendance (30-day month)** | 30 Days | 0 | 30 | 30 | 30 / 30 = 1.00 | **100% Full Gross** |
| **Full Attendance (Feb 28 days)** | 28 Days | 0 | 30 | 30 | 30 / 30 = 1.00 | **100% Full Gross** |
| **1 Day Loss of Pay** | Any | 1 | 30 | 29 | 29 / 30 = 0.9667 | **Deducts 1/30th Gross** |
| **2 Days Loss of Pay** | Any | 2 | 30 | 28 | 28 / 30 = 0.9333 | **Deducts 2/30th Gross** |
| **5 Days Loss of Pay** | Any | 5 | 30 | 25 | 25 / 30 = 0.8333 | **Deducts 5/30th Gross** |
