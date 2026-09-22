# Lead Conversion Architecture

## Overview

Lead conversion transitions a qualified inquiry into active sales transactions (Quotations, Deals, and Event Bookings).

---

## Conversion Workflow

```mermaid
flowchart LR
    Lead[Lead Record: QUALIFIED] --> Action[Click 'Generate Quotation' / 'Convert']
    Action --> Quote[Create SalesQuotation Record]
    Quote --> Status[Update Lead Status -> PROPOSAL_SENT]
    Quote --> Contract[Draft Contract]
    Contract --> Booking[Create Confirmed Booking]
    Booking --> LeadWon[Update Lead Status -> WON]
```

---

## Created & Updated Entities

- **`SalesQuotation`**: Created with line items copied from lead requirements.
- **`Deal`**: Created to track financial pipeline value.
- **`Lead.status`**: Updated to `PROPOSAL_SENT` then `WON`.
