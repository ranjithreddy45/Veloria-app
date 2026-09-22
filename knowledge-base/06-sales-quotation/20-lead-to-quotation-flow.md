# Lead to Quotation Data Flow

## Overview

Detailed field mappings from `Lead` records to `SalesQuotation` and `Quote` entities.

---

## Field Mapping Matrix

| Lead Field | Quotation Field | Transformation / Rule |
|---|---|---|
| `Lead.contact.name` | `SalesQuotation.clientName` | Copied directly |
| `Lead.contact.phone` | `SalesQuotation.clientPhone` | Copied directly |
| `Lead.contact.email` | `SalesQuotation.clientEmail` | Copied directly |
| `Lead.eventDate` | `SalesQuotation.eventDate` | Transferred to event date |
| `Lead.guestCount` | `SalesQuotation.guestCount` | Applied to per-plate pricing |
| `Lead.preferredVenueId` | Pricing Context | Fetches venue-specific rates & tax slabs |
