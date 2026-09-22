# Complete Lead Feature Index

## Overview

Authoritative feature catalog for all Lead CRM capabilities with immutable feature identifiers.

---

## Feature Catalog

| Feature ID | Feature Name | Primary Route | Primary Action / API | Primary Prisma Model | Status |
|---|---|---|---|---|---|
| `CRM-LEAD-001` | Lead Creation & Ingestion | `/leads/new` | `createLead()` | `Lead` | CODE VERIFIED |
| `CRM-LEAD-002` | AI Lead Scoring | `/leads/[id]` | `scoreLead()` | `Lead` (`aiScore`) | CODE VERIFIED |
| `CRM-LEAD-003` | Round-Robin Routing | Internal | `routeLead()` | `LeadRoutingDecision` | CODE VERIFIED |
| `CRM-LEAD-004` | Speed-to-Lead SLA Clock | `/leads/sla` | `checkSlaClock()` | `Lead` (`firstContactDue`) | CODE VERIFIED |
| `CRM-LEAD-005` | SLA War Room | `/leads/war-room` | `getWarRoomLeads()` | `Lead` | CODE VERIFIED |
| `CRM-LEAD-006` | Lead Quality Classification | `/leads/[id]` | `updateLeadQuality()` | `Lead` (`LeadQuality`) | CODE VERIFIED |
| `CRM-LEAD-007` | Meta Facebook Lead Ingestion | `/api/webhooks/facebook-leads` | Webhook Handler | `Lead`, `FacebookConfig` | CODE VERIFIED |
| `CRM-LEAD-008` | Push API Lead Ingest | `/api/v1/push/leads` | Route Handler | `Lead`, `ApiKey` | CODE VERIFIED |
| `CRM-LEAD-009` | Cooling Sweep & Winback | `/leads/cooling` | `runCoolingSweep()` | `Lead`, `WinbackTarget` | CODE VERIFIED |
| `CRM-LEAD-010` | Lead CSV Import | `/leads/import` | `importLeadsBatch()` | `Lead`, `Contact` | CODE VERIFIED |
| `CRM-LEAD-011` | Follow-Up Queue | `/leads/followups` | `getFollowUpQueue()` | `Lead` | CODE VERIFIED |
| `CRM-LEAD-012` | Lead to Quotation Conversion | `/leads/[id]` | `createQuotationFromLead()` | `SalesQuotation` | CODE VERIFIED |
