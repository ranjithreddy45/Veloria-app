# Phase 7: Master Prisma Model Index

| Model Name | Module | Purpose | Key Relations | Important Indexes | Lifecycle | Source Module |
|---|---|---|---|---|---|---|
| `User` | Auth / System | User Account | `Role`, `Employee`, `ActivityLog` | `email` | Active / Inactive | 01, 02 |
| `Role` | Auth / System | RBAC Role Definition | `User`, `Permission` | `name` | Static Configuration | 03 |
| `Lead` | CRM | Prospect Tracking | `Client`, `Quotation`, `ActivityLog` | `status`, `assignedToId` | New -> Contacted -> Qualified -> Lost | 05 |
| `Client` | CRM / Portals | Master Client Record | `Lead`, `Quotation`, `Booking`, `Invoice` | `email`, `phone` | Active | 05, 22 |
| `Quotation` | Sales | Price Proposal | `Lead`, `Client`, `QuoteItem`, `Contract` | `status`, `token` | Draft -> Sent -> Accepted -> Expired | 06 |
| `Contract` | Contracts | Legal Agreement | `Quotation`, `Booking`, `Signature` | `status`, `token` | Pending -> Signed -> Cancelled | 07 |
| `Booking` | Booking | Event Reservation | `Venue`, `Contract`, `BEO`, `Invoice` | `venueId`, `startDate` | Hold -> Confirmed -> In-Progress -> Completed | 08 |
| `BEO` | Operations | Event Operations Order | `Booking`, `BEOItem` | `bookingId`, `isLocked` | Draft -> Approved -> Locked | 09 |
| `Recipe` | Kitchen | Food Prep Formula | `InventoryItem`, `BEOItem` | `name` | Active | 10 |
| `InventoryItem` | Kitchen | Stock Item | `StockMovement`, `Supplier` | `sku`, `category` | In Stock / Reorder | 10 |
| `Vendor` | Vendor | Supplier / Service Provider | `PurchaseOrder`, `VendorBill` | `category`, `status` | Active / Suspended | 11, 22 |
| `PurchaseOrder` | Procurement | Vendor Order | `Vendor`, `VendorBill` | `vendorId`, `status` | Draft -> Sent -> Received -> Invoiced | 11 |
| `Invoice` | Invoicing | Financial Billing | `Booking`, `Payment`, `FinJournalEntry` | `invoiceNumber`, `status` | Unpaid -> Partial -> Paid -> Cancelled | 12 |
| `Payment` | Invoicing | Gateway & Manual Payout | `Invoice`, `FinJournalEntry` | `razorpayPaymentId` | Pending -> Success -> Failed -> Refunded | 12 |
| `FinAccount` | Finance | Chart of Accounts | `FinJournalLine` | `code`, `type` | Active | 13 |
| `FinJournalEntry` | Finance | General Ledger Entry | `FinJournalLine`, `FinPeriod` | `entryNumber`, `isPosted` | Draft -> Posted | 13 |
| `Employee` | HR | Staff Master | `User`, `Department`, `HrPayslip` | `employeeCode`, `userId` | Active -> Terminated | 14 |
| `AttendanceRecord` | Attendance | Daily Attendance Log | `Employee` | `employeeId`, `date` | Present / Absent / Half-Day | 15 |
| `LeaveRequest` | Leave | Leave Application | `Employee`, `LeaveType` | `employeeId`, `status` | Pending -> Approved -> Rejected | 16 |
| `HrPayslip` | Payroll | Monthly Salary Slip | `Employee`, `HrPayrollRun` | `payrollRunId`, `employeeId` | Draft -> Approved -> Paid | 17 |
| `ExpenseClaim` | Reimbursements | Employee Expense Claim | `Employee`, `VendorBill` | `employeeId`, `status` | Draft -> Approved -> Paid | 24 |
