# User Navigation Journeys

## Overview

Key end-to-end user navigation flows across application routes.

---

## Journey 1: Lead to Booking & Contract Execution

```mermaid
sequenceDiagram
    autonumber
    actor Sales as Sales Exec
    actor Client as Client

    Sales->>Sales: Access /leads
    Sales->>Sales: Navigate to /leads/new (Create Lead)
    Sales->>Sales: Navigate to /quotations/new (Generate Quote)
    Sales->>Client: Send /q/[quoteToken]
    Client->>Client: View /q/[quoteToken] & Click Accept
    Client->>Client: Redirected to /sign/[contractToken] (E-Sign)
    Client->>Client: Redirected to /pay/[bookingId] (Deposit Pay)
    Sales->>Sales: View updated /bookings/[id]
```

---

## Journey 2: BEO & Kitchen Operations Execution

```mermaid
sequenceDiagram
    autonumber
    actor Ops as Operations Coordinator
    actor Kitchen as Head Chef

    Ops->>Ops: Access /events
    Ops->>Ops: Navigate to /beo/new
    Ops->>Ops: Finalize BEO -> /beo/[id]/print
    Kitchen->>Kitchen: Access /inventory & /kitchen/prep
```
