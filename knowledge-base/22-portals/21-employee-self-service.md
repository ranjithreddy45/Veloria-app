# 21 Employee Self-Service Classification

`CODE VERIFIED`

## Architectural Finding: Internal Dashboard vs. Portal

Employee self-service functionality (viewing payslips, applying for leave, logging attendance, submitting reimbursements) is **NOT implemented as a separate standalone portal**. Instead, it is integrated into the core internal dashboard (`src/app/(dashboard)/*`), protected by NextAuth RBAC based on the user's staff role (`STAFF`, `EVENT_COORDINATOR`, `FINANCE`, `HR_EXECUTIVE`, etc.).

### Self-Service Routes Directory
- Attendance & Check-in: `/staff`
- Payslip PDFs: `/staff/payroll` -> `/api/hr/payslips/[id]/pdf`
- Leave Requests: `/leave`
- Reimbursements: `/finance/reimbursements`
