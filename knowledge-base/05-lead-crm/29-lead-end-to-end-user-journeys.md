# Lead End-to-End User Journeys

## Overview

Sequence diagrams illustrating end-to-end user navigation and data execution for lead management workflows.

---

## Journey 1: Meta Lead Ad Ingestion to Executive Contact

```mermaid
sequenceDiagram
    autonumber
    actor Prospect as Client / Prospect
    participant Meta as Meta Lead Ads API
    participant Webhook as Facebook Webhook
    participant Ingest as Push Ingest Engine
    participant DB as Prisma PostgreSQL
    participant Sales as Sales Executive

    Prospect->>Meta: Submit Lead Form on Facebook
    Meta->>Webhook: POST /api/webhooks/facebook-leads
    Webhook->>Ingest: Ingest & Score Lead
    Ingest->>DB: INSERT INTO Lead & Contact
    DB-->>Sales: SLA Clock Triggered (firstContactDue)
    Sales->>Sales: View Lead in War Room (/leads/war-room)
    Sales->>Prospect: Send WhatsApp Welcome / Call
```

---

## Journey 2: Lead Qualification & Quotation Conversion

```mermaid
sequenceDiagram
    autonumber
    actor Sales as Sales Executive
    participant UI as Lead Detail UI (/leads/[id])
    participant Action as Lead Action
    participant Quote as Quotation Engine
    participant DB as Prisma DB

    Sales->>UI: Review Inquiry Details
    Sales->>UI: Select Quality = QUALIFIED
    UI->>Action: updateLeadQuality()
    Action->>DB: UPDATE Lead SET status = QUALIFIED
    Sales->>UI: Click "Generate Quotation"
    UI->>Quote: Redirect to /quotations/new?leadId=...
    Quote->>DB: INSERT INTO SalesQuotation
```
