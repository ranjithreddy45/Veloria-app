# Phase 32: Master Database Domain Map

## 1. Domain Model Groupings
- **AUTH / SYSTEM**: `User`, `Account`, `Session`, `Role`, `Permission`, `ActivityLog`.
- **CRM / SALES**: `Lead`, `LeadActivity`, `Client`, `Quotation`, `QuoteItem`, `PublicHoldToken`.
- **CONTRACTS / BOOKING**: `Contract`, `Signature`, `Booking`, `Venue`, `VenuePrice`.
- **OPERATIONS / KITCHEN**: `BEO`, `BEOItem`, `Recipe`, `InventoryItem`, `StockMovement`.
- **PROCUREMENT / VENDOR**: `Vendor`, `PurchaseOrder`, `PurchaseOrderItem`, `VendorBill`.
- **FINANCE / INVOICING**: `Invoice`, `InvoiceLine`, `Payment`, `FinAccount`, `FinJournalEntry`, `FinJournalLine`, `FinPeriod`.
- **HR / PAYROLL**: `Employee`, `Department`, `Designation`, `AttendanceRecord`, `LeaveRequest`, `LeaveBalance`, `HrPayrollRun`, `HrPayslip`, `ExpenseClaim`.
- **RECRUITMENT / BD**: `JobOpening`, `Applicant`, `PropertyLead`, `AcquisitionDeal`.
- **MARKETING / COMM**: `Campaign`, `AttributionLog`, `WhatsAppLog`, `WhatsAppTemplate`.
