# Quotation Status Lifecycle & State Machine

## Overview

Veloria Grand maintains two quotation status enums in Prisma: `SalesQuotationStatus` for internal sales workflow and `QuoteStatus` for secondary line-item quotes.

---

## State Transition Map (`SalesQuotationStatus`)

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Initial Creation
    DRAFT --> PENDING_APPROVAL: Discount Exceeds Threshold
    DRAFT --> APPROVED: Standard Pricing / Auto-Approved
    PENDING_APPROVAL --> APPROVED: Sales Manager / Admin Approved
    PENDING_APPROVAL --> REJECTED: Discount Rejected
    APPROVED --> SENT: Tokenized Share Link Dispatched
    SENT --> CONVERTED: Client Accepted & Deposit Paid
    SENT --> REJECTED: Client Rejected Proposal
    CONVERTED --> [*]
```

---

## Status Definitions

- `DRAFT`: Initial quote under construction.
- `PENDING_APPROVAL`: Requires `SALES_HEAD` or `ADMIN` approval due to high discounts.
- `APPROVED`: Pricing finalized and ready to send.
- `SENT`: Tokenized public share link active (`/q/[token]`).
- `REJECTED`: Proposal rejected by manager or client.
- `CONVERTED`: Terminal "won" state; booking confirmed and deposit invoice generated.
