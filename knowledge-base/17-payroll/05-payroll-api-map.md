# 05 Payroll API Endpoints

## API Route Inventory

| Endpoint | File Path | Method | Purpose |
| :--- | :--- | :--- | :--- |
| `/api/hr/payslips/[id]/pdf` | `src/app/api/hr/payslips/[id]/pdf/route.ts` | GET | PDF Payslip Generator |
| `/api/hr/form16/[employeeId]` | `src/app/api/hr/form16/[employeeId]/route.ts` | GET | Annual Form 16 Tax Certificate |
| `/api/cron/hr-reminders` | `src/app/api/cron/hr-reminders/route.ts` | GET | Automated Payroll & Document Reminders |
