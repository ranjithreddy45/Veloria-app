# Chunk 05: Lead CRM & Acquisition Module

## Overview

This directory contains the technical and functional documentation for the Veloria Grand Lead CRM & Acquisition Module, covering multi-channel ingestion, AI lead scoring, round-robin assignment, SLA clocks, quotation conversion, and winback engines.

---

## Table of Contents

| Document | Title | Description |
|---|---|---|
| [01-lead-crm-overview.md](01-lead-crm-overview.md) | Module Architecture | Technical pipeline and flow architecture. |
| [02-lead-crm-business-purpose.md](02-lead-crm-business-purpose.md) | Business Scope | Business objectives and SLA targets. |
| [03-lead-sources-and-ingestion.md](03-lead-sources-and-ingestion.md) | Lead Sources & Ingestion | 17 supported lead sources and ingestion webhooks. |
| [04-lead-creation.md](04-lead-creation.md) | Lead Creation Workflows | Manual and automated lead creation pathways. |
| [05-lead-profile-and-details.md](05-lead-profile-and-details.md) | Profile & Detail View | Interface breakdown of `/leads/[leadId]`. |
| [06-lead-status-lifecycle.md](06-lead-status-lifecycle.md) | Lead Status Lifecycle | Enforced state machine (`NEW` -> `QUALIFIED` -> `WON`/`LOST`). |
| [07-lead-assignment-and-ownership.md](07-lead-assignment-and-ownership.md) | Assignment & Ownership | Manual, bulk, and automated ownership routing. |
| [08-lead-scoring.md](08-lead-scoring.md) | AI Lead Scoring | OpenAI LLM sentiment and heuristic scoring engine. |
| [09-lead-round-robin.md](09-lead-round-robin.md) | Round-Robin Routing | Availability-aware sales rep distribution algorithm. |
| [10-lead-follow-up-and-tasks.md](10-lead-follow-up-and-tasks.md) | Follow-Ups & Reminders | Follow-up deadlines, SLA clocks, and task logs. |
| [11-lead-communication-history.md](11-lead-communication-history.md) | Communication History | Touchpoint counting across Call, WhatsApp, Email, Visits. |
| [12-lead-notes-and-activities.md](12-lead-notes-and-activities.md) | Notes & Activity Logs | Internal CRM notes and system audit trails. |
| [13-lead-qualification.md](13-lead-qualification.md) | Lead Qualification | Quality classification and qualification fields. |
| [14-lead-conversion.md](14-lead-conversion.md) | Lead Conversion Architecture | Conversion to Quotations, Deals, and Bookings. |
| [15-lead-to-quotation-flow.md](15-lead-to-quotation-flow.md) | Lead to Quotation Flow | Field pre-population and quotation generation. |
| [16-lead-to-booking-flow.md](16-lead-to-booking-flow.md) | Lead to Booking Flow | Progression to confirmed venue bookings. |
| [17-lead-rejection-and-closure.md](17-lead-rejection-and-closure.md) | Rejection & Closure | Lost lead reasons and cooling sweep re-engagement. |
| [18-lead-reassignment.md](18-lead-reassignment.md) | Lead Reassignment | Single and bulk reassignment workflows. |
| [19-lead-search-filter-and-listing.md](19-lead-search-filter-and-listing.md) | Search, Filter & Listing | High-performance search, filters, and saved views. |
| [20-lead-import-export.md](20-lead-import-export.md) | Import & Export Mechanics | Bulk CSV import and parsing pipeline. |
| [21-lead-notifications.md](21-lead-notifications.md) | Lead Notifications & SLA Alerts | Email, in-app, and SLA breach alert dispatches. |
| [22-lead-whatsapp-and-communication.md](22-lead-whatsapp-and-communication.md) | WhatsApp Integration | Meta WhatsApp Cloud API auto-welcome & catalog links. |
| [23-lead-automation-and-crons.md](23-lead-automation-and-crons.md) | Automation & Cron Routines | Background crons for cooling sweep, SLA, and winback. |
| [24-lead-permissions-and-role-access.md](24-lead-permissions-and-role-access.md) | Permissions & Role Access | Access control rules across executive and admin roles. |
| [25-lead-database-model.md](25-lead-database-model.md) | Database Schema | Prisma `Lead` model, relations, and entity diagram. |
| [26-lead-server-actions-and-api.md](26-lead-server-actions-and-api.md) | Server Actions & API Inventory | Backend Server Actions and API endpoint index. |
| [27-lead-validation-and-business-rules.md](27-lead-validation-and-business-rules.md) | Validation & Business Rules | Zod validation schemas (`createLeadSchema`). |
| [28-lead-integrations.md](28-lead-integrations.md) | Service Integrations | Meta, Google Ads, WhatsApp, and OpenAI integration maps. |
| [29-lead-end-to-end-user-journeys.md](29-lead-end-to-end-user-journeys.md) | User Sequence Journeys | End-to-end user navigation sequence diagrams. |
| [30-lead-feature-dependency-map.md](30-lead-feature-dependency-map.md) | Feature Dependency Map | Upstream and downstream module connections. |
| [31-lead-brief-vs-code-traceability.md](31-lead-brief-vs-code-traceability.md) | Brief Traceability Matrix | Cross-reference against the Autopilot Business Brief. |
| [32-lead-gaps-and-verification.md](32-lead-gaps-and-verification.md) | Gaps & Verification Matrix | Factual audit matrix verifying code functionality. |
| [33-complete-lead-feature-index.md](33-complete-lead-feature-index.md) | Complete Feature Index | Immutable feature catalog (`CRM-LEAD-001` - `CRM-LEAD-012`). |

---

## Status Summary

- **Module Status**: `COMPLETE`
- **Verification**: `CODE VERIFIED` against production App Router codebase.
