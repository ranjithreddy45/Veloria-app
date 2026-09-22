# CHUNK 02-07 — SERVER ACTION SECURITY

- **Status**: `CODE VERIFIED`
- **Module**: Authentication & Security
- **Target Path**: `knowledge-base/02-authentication-security/07-server-action-security.md`

---

## 🔒 Server Action Security Enforceability

Because Server Actions (`"use server"`) expose HTTP POST endpoints accessible via RPC, every Server Action must perform explicit server-side authentication and permission assertions.

### 🛡️ Classification of Server Actions by Security Boundary

| Security Category | Description | Protection Pattern | Example Actions |
|---|---|---|---|
| **Public / Unauthenticated** | Accessible without user session (Rate-limited) | Tokenized URL parameter / CORS API Key | `ingestLead()`, `submitPublicRsvp()`, `viewPublicQuote()` |
| **Authenticated Staff** | Requires active staff session | `requireUser()` / `auth()` check | `createTask()`, `updateMyProfile()`, `clockInAttendance()` |
| **Role-Protected** | Restricted to specific `UserRole` enums | `if (!INTERNAL_ROLES.includes(role))` | `approvePayrollRun()`, `cancelInvoice()`, `updateRole()` |
| **Permission-Protected** | Evaluates explicit granular permission key | `hasPermission(role, "hr:read")` | `createReimbursementClaim()`, `createSalesQuotation()` |
| **Ownership-Scoped** | Restricts mutation to records owned by user | `where: { employeeId: session.user.id }` | `updateMyExpenseClaim()`, `cancelMyLeaveRequest()` |

---

## 🔍 Tracing 10 Production Server Actions

1. `createReimbursementClaim()` (`src/actions/hr-reimbursement.actions.ts`): Requires session + `hr:read` permission.
2. `approveReimbursementStage()` (`src/actions/hr-reimbursement.actions.ts`): Asserts `hr:write` or `finance:read` + checks manager hierarchy.
3. `createBooking()` (`src/actions/booking.actions.ts`): Asserts `bookings:create` + slot availability transaction.
4. `createInvoice()` (`src/actions/invoice.actions.ts`): Asserts `invoices:create` permission.
5. `createRazorpayPaymentOrder()` (`src/actions/payment.actions.ts`): Verifies invoice ownership or public tokenized link.
6. `createSalesQuotation()` (`src/actions/sales-quotation.actions.ts`): Asserts `quotes:create` + verifies maximum allowed discount.
7. `deleteLead()` (`src/actions/lead.actions.ts`): Asserts `leads:delete` permission (Restricted to `SALES_HEAD`, `ADMIN`, `SUPER_ADMIN`).
8. `updateEmployeeSalary()` (`src/actions/hr-payroll.actions.ts`): Asserts `hr:write` + checks role is `HR_MANAGER` or `ADMIN`.
9. `postJournalVoucher()` (`src/actions/finance.actions.ts`): Asserts `finance:read` permission + GL account validation.
10. `cancelBooking()` (`src/actions/booking.actions.ts`): Asserts `bookings:cancel` + verifies booking status is not already `COMPLETED`.
