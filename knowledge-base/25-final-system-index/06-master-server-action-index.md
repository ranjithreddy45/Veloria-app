# Phase 6: Master Server Action Index

| Action | Source File | Module | Auth | Authorization | Models | Transaction | Side Effects | Status |
|---|---|---|---|---|---|---|---|---|
| `createLeadAction` | `src/actions/lead.ts` | CRM | NextAuth | `MANAGE_LEADS` | `Lead`, `ActivityLog` | Yes | SLA Timer, Auto Assignment | IMPLEMENTED |
| `createQuotationAction` | `src/actions/sales.ts` | Sales | NextAuth | `MANAGE_SALES` | `Quotation`, `QuoteItem` | Yes | Tax Calc, PDF Gen | IMPLEMENTED |
| `acceptQuoteAction` | `src/actions/public-quote.ts` | Sales | Token | Public Link Token | `Quotation`, `PublicHoldToken` | Yes | Hold Creation, Email/WA Alert | IMPLEMENTED |
| `signContractAction` | `src/actions/contract.ts` | Contracts | Token | Public Link Token | `Contract`, `Signature` | Yes | Status Update, PDF Stamp | IMPLEMENTED |
| `createBookingAction` | `src/actions/booking.ts` | Booking | NextAuth | `MANAGE_BOOKINGS` | `Booking`, `Venue` | Yes | Calendar Lock, BEO Init | IMPLEMENTED |
| `lockBeoAction` | `src/actions/beo.ts` | Operations | NextAuth | `MANAGE_OPERATIONS` | `BEO`, `BEOItem` | Yes | Read-only state lock | IMPLEMENTED |
| `createPurchaseOrderAction` | `src/actions/procurement.ts` | Procurement | NextAuth | `PROCUREMENT_MANAGER` | `PurchaseOrder` | Yes | Stock Order, Vendor Notify | IMPLEMENTED |
| `createInvoiceAction` | `src/actions/invoice.ts` | Invoicing | NextAuth | `FINANCE_MANAGER` | `Invoice`, `InvoiceLine` | Yes | GL Posting (AR), PDF Gen | IMPLEMENTED |
| `postJournalEntryAction` | `src/actions/finance.ts` | Finance | NextAuth | `FINANCE_MANAGER` | `FinJournalEntry`, `FinJournalLine` | Yes | Double-entry check, GL balance | IMPLEMENTED |
| `processPayrollAction` | `src/actions/hr.ts` | Payroll | NextAuth | `HR_MANAGER` | `HrPayslip`, `HrPayrollRun` | Yes | Fixed 30-day calc, GL Posting | IMPLEMENTED |
| `submitClaimAction` | `src/actions/reimbursements.ts` | HR / Finance | NextAuth | `EMPLOYEE` | `ExpenseClaim` | Yes | AP Bill Creation, S3 Receipt | IMPLEMENTED |
