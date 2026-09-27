# LEAD TO QUOTATION & BOOKING INTEGRATION

## 1. Conversion Bridges

- **Lead ──► Quotation**:
  - Click `"Create Quotation"` on `/leads/[leadId]` `LeadQuickActions`.
  - Navigates to `/quotations/new?leadId=...`.
  - Pre-populates client name, phone, email, event date, guest count, and venue preference.
- **Lead ──► Booking**:
  - Direct conversion via `convertLeadToCustomer()` creating formal customer and booking records.
