# Quotation to Contract Flow

## Overview

Progression from an approved or accepted quotation to a digital contract agreement.

---

## Progression Mechanics

- **Trigger**: Client accepts quotation via `/q/[token]` or sales exec clicks **"Generate Contract"**.
- **Data Transfer**: `SalesQuotation.grandTotal`, `eventDate`, `timeSlot`, and `inputsJson` populate `Contract` terms.
- **Contract Link**: `Contract.quotationId` references `SalesQuotation.id`.
