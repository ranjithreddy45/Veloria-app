# 15 - Quotation to Booking Conversion Workflow

---

## 🔄 Quotation Conversion Engine

```mermaid
sequenceDiagram
    autonumber
    actor Sales as Sales Executive
    participant Quote as SalesQuotation
    participant Action as booking-invoice.actions.ts
    participant Booking as Booking Model
    participant Inv as Invoice Model

    Sales->>Quote: Select "Convert to Booking" (Status = APPROVED)
    Quote->>Action: Execute `createBookingInvoiceFromQuotation(quotationId)`
    Action->>Action: Validate venue & date slot availability
    Action->>Booking: Create new Booking record (status = HOLD / CONFIRMED)
    Action->>Quote: Update SalesQuotation.status = CONVERTED
    Action->>Inv: Generate initial deposit Invoice (e.g. 25% advance)
    Action-->>Sales: Return bookingNumber & invoiceId
```

- **File Reference**: `src/actions/booking-invoice.actions.ts`
- **Data Preserved**: All custom menu selections, add-ons, pricing tiers, client contact IDs, and venue assignments are copied seamlessly without data loss.
