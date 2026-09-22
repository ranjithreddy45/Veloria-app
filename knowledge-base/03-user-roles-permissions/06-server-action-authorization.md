# CHUNK 03-06 — SERVER ACTION AUTHORIZATION

- **Status**: `CODE VERIFIED`
- **Module**: Roles & RBAC System
- **Target Path**: `knowledge-base/03-user-roles-permissions/06-server-action-authorization.md`

---

## 🔒 Tracing Authorization Checks in 15 Production Server Actions

Below is the verified audit trace of 15 production Server Actions across core modules:

| Server Action Name | File Path | Module | Authentication Requirement | Permission Checked | Role Check | Resource Ownership Scope |
|---|---|---|---|---|---|---|
| `createReimbursementClaim()` | `src/actions/hr-reimbursement.actions.ts` | HR | Session Required | `hr:read` | None | Scoped to `employeeId` |
| `approveReimbursementStage()`| `src/actions/hr-reimbursement.actions.ts` | HR | Session Required | `hr:write` / `finance:read` | Manager / HR Role | Scoped to approver hierarchy |
| `createBooking()` | `src/actions/booking.actions.ts` | Bookings | Session Required | `bookings:create` | None | Checks slot collision |
| `cancelBooking()` | `src/actions/booking.actions.ts` | Bookings | Session Required | `bookings:cancel` | None | Verifies booking status |
| `createInvoice()` | `src/actions/invoice.actions.ts` | Invoices | Session Required | `invoices:create` | None | Booking balance check |
| `cancelInvoice()` | `src/actions/invoice-cancel.actions.ts` | Invoices | Session Required | `invoices:cancel` | `ADMIN`, `SUPER_ADMIN` | Invoice balance check |
| `createRazorpayPaymentOrder()`| `src/actions/payment.actions.ts` | Payments | Session / Token | `payments:create` | None | Scoped to `invoiceId` |
| `recordPayment()` | `src/actions/payment.actions.ts` | Payments | Session Required | `payments:create` | None | Cash/Bank ledger check |
| `createSalesQuotation()` | `src/actions/sales-quotation.actions.ts` | Quotes | Session Required | `quotes:create` | None | Discount limit threshold |
| `deleteLead()` | `src/actions/lead.actions.ts` | Leads | Session Required | `leads:delete` | `SALES_HEAD`, `ADMIN` | Lead status check |
| `assignLead()` | `src/actions/lead.actions.ts` | Leads | Session Required | `leads:assign` | `SALES_HEAD`, `ADMIN` | Rep capacity check |
| `updateEmployeeSalary()` | `src/actions/hr-payroll.actions.ts` | Payroll | Session Required | `hr:write` | `HR_MANAGER`, `ADMIN` | Salary slab check |
| `postJournalVoucher()` | `src/actions/finance.actions.ts` | Finance | Session Required | `finance:read` | `FINANCE`, `ADMIN` | GL account validation |
| `updateUserRole()` | `src/actions/admin.actions.ts` | Admin | Session Required | `users:manage-roles` | `SUPER_ADMIN`, `ADMIN` | Prevents self-demotion |
| `updateQualityScorecard()` | `src/actions/quality.actions.ts` | Quality | Session Required | `quality:read` | `ADMIN`, `SUPER_ADMIN` | Audit log record |
