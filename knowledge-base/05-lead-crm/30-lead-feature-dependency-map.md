# Lead Feature Dependency Map

## Overview

Maps upstream and downstream module dependencies connected to Lead CRM.

---

## Dependency Graph

```mermaid
graph TD
    Ingest[Lead Ingestion] --> LeadCRM[Lead CRM Core]
    LeadCRM --> QuotationEngine[Quotations Module]
    QuotationEngine --> ContractEngine[Contracts Module]
    ContractEngine --> BookingEngine[Bookings Module]
    LeadCRM --> ContactDB[Contact Management]
    LeadCRM --> NotificationEngine[WhatsApp & Email Alerts]
```

---

## Upstream & Downstream Dependencies

- **Upstream Dependencies**:
  - `Contact` model (stores client identity, phone, email).
  - `User` model (assigned sales executive).
  - `Venue` model (preferred event location).
- **Downstream Dependencies**:
  - `SalesQuotation` (created from qualified leads).
  - `Booking` (created upon lead win).
