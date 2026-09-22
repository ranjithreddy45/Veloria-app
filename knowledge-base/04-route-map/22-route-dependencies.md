# Route Dependencies

## Overview

Documents prerequisites and route chaining across business workflows.

---

## Workflow Chaining Matrix

| Source Route | Prerequisite Condition | Target Upstream Route |
|---|---|---|
| `/quotations/new` | Lead must exist | `/leads/[id]` |
| `/sign/[contractToken]` | Quotation accepted | `/q/[quoteToken]` |
| `/pay/[bookingId]` | Contract signed | `/sign/[contractToken]` |
| `/beo/[id]` | Booking confirmed | `/events/[id]` |
