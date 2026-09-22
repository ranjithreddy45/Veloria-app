# 04 - Booking Creation Pathways

---

## 📌 Supported Creation Pathways

Veloria Grand supports 4 distinct pathways for creating a `Booking` record:

```mermaid
sequenceDiagram
    autonumber
    actor User as Sales Exec / Client
    participant UI as Application UI
    participant Action as Server Action
    participant DB as PostgreSQL Database
    participant Cron as Cron System

    alt Pathway 1: Quotation Conversion (Primary Sales Flow)
        User->>UI: Click "Convert to Booking" on Quotation Screen
        UI->>Action: Call `createBookingInvoiceFromQuotation(quotationId)`
        Action->>DB: Check venue & timeSlot availability
        Action->>DB: Insert Booking & update SalesQuotation status = CONVERTED
        Action->>DB: Create initial deposit Invoice
    else Pathway 2: Manual Direct Booking (Admin/Internal)
        User->>UI: Fill Booking Form (/bookings/new)
        UI->>Action: Call `createBooking(data)`
        Action->>DB: Validate Zod schema & availability
        Action->>DB: Insert Booking (status = HOLD / CONFIRMED)
    else Pathway 3: Public Slot Hold Locking (Self-Service Client Flow)
        User->>UI: Submit Public Hold Form (/public/hold)
        UI->>Action: Call `createPublicHold(data)`
        Action->>DB: Create PublicHold record with token
        Action->>DB: Mint candidate Lead & auto-create HOLD Booking
    else Pathway 4: Direct Contract Promotion
        User->>UI: Client Signs Contract (/sign/[token])
        UI->>Action: Call `signContract(token)`
        Action->>DB: Lock contract & promote linked Booking status to CONFIRMED
    end
```

---

## 📋 Field Copying & Invariant Rules
When converted from a `SalesQuotation`:
- `eventName` <- `SalesQuotation.eventName`
- `eventType` <- `SalesQuotation.eventType`
- `guestCount` <- `SalesQuotation.guestCount`
- `date` <- `SalesQuotation.eventDate`
- `timeSlot` <- `SalesQuotation.timeSlot`
- `venueId` <- `SalesQuotation.venueId`
- `totalAmount` <- `SalesQuotation.totalAmount`
- `perPlatePrice` <- `SalesQuotation.perPlatePrice`
- `contactId` <- `SalesQuotation.lead.contactId`
- `bookingNumber` <- Generated via `generateBookingNumber()` (e.g. `VG-BK-2026-0042`)
