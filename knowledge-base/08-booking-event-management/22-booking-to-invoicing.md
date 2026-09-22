# 22 - Booking to Invoicing Integration

---

## 🧾 Invoice Generation Mechanics

- **Server Action**: `createBookingInvoiceFromQuotation(quotationId)` in `src/actions/booking-invoice.actions.ts`.
- **Milestone Structure**:
  - Deposit Invoice (25% Advance upon booking confirmation)
  - Pre-Event Interim Invoice (50% due 14 days prior to event date)
  - Final Settlement Invoice (Remaining 25% + variable consumption charges)
- **GST Compliance**: Tax calculation handles intra-state CGST+SGST or inter-state IGST based on venue location and client state code.
