# Route to Database Domain Map

## Overview

Maps primary route clusters to target Prisma database models.

---

## Database Domain Mapping

- **Sales Routes** (`/leads`, `/quotations`): `Lead`, `Quotation`, `QuotationItem`, `LeadActivity`
- **Events & BEO** (`/events`, `/beo`): `Booking`, `Event`, `BEO`, `BEOItem`, `Venue`
- **HR & Staff** (`/hr`, `/employees`): `User`, `EmployeeProfile`, `Attendance`, `LeaveRequest`
- **Finance** (`/finance`, `/invoices`): `Invoice`, `Payment`, `GeneralLedger`, `ExpenseClaim`
