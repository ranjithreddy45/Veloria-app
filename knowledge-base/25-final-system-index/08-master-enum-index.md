# Phase 8: Master Enum Index

| Enum Name | Values | Module | Purpose | State Machine / Lifecycle |
|---|---|---|---|---|
| `LeadStatus` | `NEW`, `CONTACTED`, `QUALIFIED`, `PROPOSAL_SENT`, `NEGOTIATION`, `WON`, `LOST` | CRM | Lead lifecycle tracking | Sequential pipeline |
| `QuotationStatus` | `DRAFT`, `PENDING_APPROVAL`, `SENT`, `ACCEPTED`, `REJECTED`, `EXPIRED` | Sales | Quotation state | Draft -> Sent -> Accepted |
| `ContractStatus` | `DRAFT`, `SENT`, `PARTIALLY_SIGNED`, `FULLY_SIGNED`, `CANCELLED`, `EXPIRED` | Contracts | Contract state | Sent -> Signed |
| `BookingStatus` | `HOLD`, `TENTATIVE`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` | Booking | Event booking status | Hold -> Confirmed -> Completed |
| `BEOStatus` | `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `LOCKED`, `COMPLETED` | Operations | BEO state | Draft -> Approved -> Locked |
| `InvoiceStatus` | `DRAFT`, `ISSUED`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, `CANCELLED`, `REFUNDED` | Invoicing | Invoice financial state | Issued -> Paid |
| `PaymentStatus` | `PENDING`, `AUTHORIZED`, `CAPTURED`, `FAILED`, `REFUNDED` | Invoicing | Razorpay/Cash payment | Pending -> Captured |
| `FinAccountType` | `ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE` | Finance | COA Account Type | Classification |
| `EmploymentStatus` | `PROBATION`, `PERMANENT`, `NOTICE_PERIOD`, `TERMINATED`, `RESIGNED` | HR | Employee lifecycle | Active -> Terminated |
| `LeaveStatus` | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` | Leave | Leave request status | Pending -> Approved |
| `PayslipStatus` | `DRAFT`, `CALCULATED`, `APPROVED`, `DISBURSED` | Payroll | Monthly payroll cycle | Draft -> Disbursed |
| `ExpenseClaimStatus` | `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `PAID` | Reimbursements | Expense reimbursement | Submitted -> Paid |
