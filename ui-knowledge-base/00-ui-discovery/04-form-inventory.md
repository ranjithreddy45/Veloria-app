# Phase 00: Form Inventory

## 1. Master Form Catalog Summary
- **Total Discovered Forms**: 85 Functional User-Facing Forms.
- **Validation Standard**: React Hook Form + Zod validation schemas.

## 2. Representative Form Inventory (FORM-0001 to FORM-0015)

| Form ID | Form Name | Route / Screen | File Path | Validation Schema | Submit Action |
|---|---|---|---|---|---|
| FORM-0001 | Quick Lead Entry Form | `/leads` | `src/components/crm/lead-form.tsx` | `CreateLeadSchema` | `createLeadAction` |
| FORM-0002 | Quotation Builder Form | `/quotations/new` | `src/app/(dashboard)/quotations/new/page.tsx` | `QuotationFormSchema` | `createQuotationAction` |
| FORM-0003 | Contract Template Form | `/settings/contract-templates` | `src/components/contracts/template-form.tsx` | `TemplateSchema` | `createContractTemplateAction` |
| FORM-0004 | Digital E-Sign Form | `/sign/[token]` | `src/app/sign/[token]/page.tsx` | `SignContractSchema` | `signContractAction` |
| FORM-0005 | Venue Booking Form | `/bookings/new` | `src/components/booking/booking-form.tsx` | `BookingFormSchema` | `createBookingAction` |
| FORM-0006 | BEO Item Entry Form | `/beo/[id]` | `src/components/beo/beo-item-form.tsx` | `BeoItemSchema` | `addBeoItemAction` |
| FORM-0007 | Recipe Costing Form | `/kitchen/recipes/new` | `src/components/kitchen/recipe-form.tsx` | `RecipeSchema` | `createRecipeAction` |
| FORM-0008 | Purchase Requisition Form| `/procurement/new` | `src/components/procurement/pr-form.tsx` | `PurchaseReqSchema` | `createPurchaseRequisitionAction` |
| FORM-0009 | Invoice Generator Form | `/invoices/new` | `src/components/invoices/invoice-form.tsx` | `InvoiceFormSchema` | `createInvoiceAction` |
| FORM-0010 | Manual Journal Entry Form| `/finance/journals/new` | `src/components/finance/journal-form.tsx` | `JournalEntrySchema` | `postJournalEntryAction` |
| FORM-0011 | Employee Profile Form | `/people/new` | `src/components/hr/employee-form.tsx` | `EmployeeSchema` | `createEmployeeAction` |
| FORM-0012 | Attendance Log Form | `/hr/attendance/manual`| `src/components/hr/attendance-form.tsx` | `AttendanceSchema` | `logManualAttendanceAction` |
| FORM-0013 | Leave Application Form | `/me/leave` | `src/components/hr/leave-form.tsx` | `LeaveRequestSchema` | `submitLeaveRequestAction` |
| FORM-0014 | Expense Claim Form | `/me/reimbursements` | `src/components/hr/expense-claim-form.tsx` | `ExpenseClaimSchema` | `submitClaimAction` |
| FORM-0015 | Vendor Bid Submission Form| `/vendor-portal/bids` | `src/components/vendor/bid-form.tsx` | `VendorBidSchema` | `submitVendorBidAction` |
