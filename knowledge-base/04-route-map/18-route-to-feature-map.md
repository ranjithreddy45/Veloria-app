# Route to Feature Map

## Overview

Maps application routes to the 24 functional modules defined in the Master Feature Registry (`knowledge-base/00-discovery/00-master-feature-registry.md`).

---

## Module Mapping

- **Module 05 (Lead CRM)**: `/leads`, `/leads/[id]`, `/leads/new`
- **Module 06 (Quotations)**: `/quotations`, `/quotations/[id]`, `/q/[quoteToken]`
- **Module 07 (Contracts)**: `/contracts`, `/contracts/[id]`, `/sign/[contractToken]`
- **Module 08 (Bookings)**: `/bookings`, `/events`, `/pay/[bookingId]`
- **Module 09 (BEO Operations)**: `/beo`, `/beo/[id]`, `/beo/[id]/print`
- **Module 12 (Invoicing & Payments)**: `/invoices`, `/payments`, `/api/webhooks/razorpay`
- **Module 14 (Employee Central)**: `/hr`, `/employees`, `/employees/[id]`
