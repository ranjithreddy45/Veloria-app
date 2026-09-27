# Phase 00: Table Inventory

## 1. Master Table & Data Grid Catalog Summary
- **Total Discovered Tables & Grids**: 95 Master Tables.
- **Table Features**: Sorting, filtering, global search, pagination, bulk row actions, CSV/Excel export.

## 2. Representative Table Inventory (TABLE-0001 to TABLE-0010)

| Table ID | Screen Name | Route | File Path | Major Columns | Data Source |
|---|---|---|---|---|---|
| TABLE-0001 | Leads Directory Table | `/leads` | `src/app/(dashboard)/leads/page.tsx` | Name, Phone, Status, Assigned Rep, SLA, Actions | `Lead` |
| TABLE-0002 | Quotations Table | `/quotations` | `src/app/(dashboard)/quotations/page.tsx` | Quote #, Client, Venue, Subtotal, Tax, Total, Status | `Quotation` |
| TABLE-0003 | Bookings Master Table | `/bookings` | `src/app/(dashboard)/bookings/page.tsx` | Booking #, Event Date, Venue, Guest Count, Status | `Booking` |
| TABLE-0004 | BEO Function Sheets Table| `/beo` | `src/app/(dashboard)/beo/page.tsx` | BEO #, Booking #, Venue, Readiness, Lock Status | `BEO` |
| TABLE-0005 | Inventory Stock Table | `/inventory` | `src/app/(dashboard)/inventory/page.tsx` | SKU, Item Name, Category, Stock Level, Reorder Point | `InventoryItem` |
| TABLE-0006 | Purchase Orders Table | `/procurement` | `src/app/(dashboard)/procurement/page.tsx` | PO #, Vendor, Total Amount, PR Link, Status | `PurchaseOrder` |
| TABLE-0007 | Invoices Directory Table | `/invoices` | `src/app/(dashboard)/invoices/page.tsx` | Invoice #, Client, Amount, Tax, Due Date, Status | `Invoice` |
| TABLE-0008 | General Ledger Journals | `/finance` | `src/app/(dashboard)/finance/page.tsx` | Entry #, Date, Description, Total Debit, Total Credit | `FinJournalEntry` |
| TABLE-0009 | Employee Master Directory| `/people` | `src/app/(dashboard)/people/page.tsx` | Emp Code, Name, Dept, Designation, Status | `Employee` |
| TABLE-0010 | Monthly Payroll Sheet | `/people/payroll` | `src/app/(dashboard)/people/payroll/page.tsx` | Emp Code, Name, Base Salary, LOP Days, Net Pay | `HrPayslip` |
