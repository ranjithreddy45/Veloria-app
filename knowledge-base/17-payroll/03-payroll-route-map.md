# 03 Payroll Route & Navigation Map

## Dashboard Page Routes (`src/app/(dashboard)/people/payroll/`)

| Route | File Path | Scope | Purpose |
| :--- | :--- | :--- | :--- |
| `/people/payroll` | `src/app/(dashboard)/people/payroll/page.tsx` | HR / Payroll Admin | Payroll Runs Directory & Cockpit |
| `/people/payroll/[runId]` | `src/app/(dashboard)/people/payroll/[runId]/page.tsx` | Payroll Specialist | Payroll Run Summary & Employee Payslips |
| `/people/payroll/advances` | `src/app/(dashboard)/people/payroll/advances/page.tsx` | HR / Cashier | Salary Advance Recovery Tracking |
| `/people/payroll/arrears` | `src/app/(dashboard)/people/payroll/arrears/page.tsx` | Payroll Specialist | Back-dated Salary Arrears Queue |
| `/people/payroll/disbursement` | `src/app/(dashboard)/people/payroll/disbursement/page.tsx` | Finance / Cashier | Bank Salary Disbursement Files |
| `/people/payroll/fnf` | `src/app/(dashboard)/people/payroll/fnf/page.tsx` | HR Manager | Full & Final Exit Settlements |
| `/people/payroll/registers` | `src/app/(dashboard)/people/payroll/registers/page.tsx` | Payroll Auditor | Monthly Salary & Statutory Registers |
| `/people/my/payslips` | `src/app/(dashboard)/people/my/payslips/page.tsx` | Employee | Personal Downloadable Payslips |
| `/finance/payroll` | `src/app/(dashboard)/finance/payroll/page.tsx` | Finance Head | Finance GL Payroll Posting Portal |
