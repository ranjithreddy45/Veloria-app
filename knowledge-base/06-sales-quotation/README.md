# Chunk 06: Sales Quotation & Dynamic Pricing Engine

## Overview

This directory contains the complete technical and functional documentation for the Veloria Grand Sales Quotation & Dynamic Pricing Engine, covering proposal creation, multi-tiered packages, yield pricing multipliers, discount approvals, public tokenized sharing (`/q/[token]`), Quote Radar view tracking, and one-tap booking conversions.

---

## Table of Contents

| Document | Title | Description |
|---|---|---|
| [01-quotation-module-overview.md](01-quotation-module-overview.md) | Module Architecture | Technical pipeline and architecture diagram. |
| [02-quotation-business-purpose.md](02-quotation-business-purpose.md) | Business Scope | Core business objectives and yield targets. |
| [03-quotation-route-and-navigation-map.md](03-quotation-route-and-navigation-map.md) | Route Census | Internal dashboard and public proposal routes. |
| [04-quotation-creation.md](04-quotation-creation.md) | Creation Workflows | Manual and lead pre-population pathways. |
| [05-quotation-detail-and-editor.md](05-quotation-detail-and-editor.md) | Detail & Editor View | Interface breakdown of `/quotations/[id]`. |
| [06-quotation-status-lifecycle.md](06-quotation-status-lifecycle.md) | Status Lifecycle | State machine (`DRAFT` -> `APPROVED` -> `SENT` -> `CONVERTED`). |
| [07-quotation-versioning.md](07-quotation-versioning.md) | Versioning System | Proposal revision history and frozen output JSON. |
| [08-quotation-line-items.md](08-quotation-line-items.md) | Line Items & Add-Ons | Itemized catalog additions (`QuoteLineItem`). |
| [09-package-and-catalog-system.md](09-package-and-catalog-system.md) | Package & Catalog System | Venue packages (`EventPackage`) and menu items. |
| [10-pricing-calculation-engine.md](10-pricing-calculation-engine.md) | Pricing Engine | Calculation pipeline for per-plate, demand, and taxes. |
| [11-seasonal-pricing.md](11-seasonal-pricing.md) | Seasonal & Yield Pricing | Dynamic pricing rules (`PricingRuleType` enum). |
| [12-discounts-and-adjustments.md](12-discounts-and-adjustments.md) | Discounts & Controls | Role-based approval thresholds for discounts. |
| [13-tax-and-fee-calculation.md](13-tax-and-fee-calculation.md) | Tax & GST Calculation | Indian GST compliance (18% via `VenueTaxSlab`). |
| [14-quotation-total-calculation.md](14-quotation-total-calculation.md) | Grand Total Calculation | Formula, precision (`Decimal(12,2)`), and currency. |
| [15-quotation-approval.md](15-quotation-approval.md) | Approval Workflow | Manager review process for special pricing requests. |
| [16-quotation-public-viewer.md](16-quotation-public-viewer.md) | Public Proposal Viewer | Client proposal viewer portal (`/q/[token]`). |
| [17-quotation-share-links.md](17-quotation-share-links.md) | Share Links & Security | Unguessable tokenized proposal URL generation. |
| [18-quotation-view-tracking.md](18-quotation-view-tracking.md) | Quote Radar Telemetry | Real-time dwell-time and device tracking (`QuoteView`). |
| [19-quotation-followups-and-nudges.md](19-quotation-followups-and-nudges.md) | Follow-Ups & Nudges | Automated silent nudge cadence for viewed proposals. |
| [20-lead-to-quotation-flow.md](20-lead-to-quotation-flow.md) | Lead Data Flow | Field mappings from `Lead` to `SalesQuotation`. |
| [21-quotation-to-contract-flow.md](21-quotation-to-contract-flow.md) | Contract Flow | Progression to digital contract agreements. |
| [22-quotation-to-booking-flow.md](22-quotation-to-booking-flow.md) | Booking Flow | Converting accepted proposals to confirmed bookings. |
| [23-quotation-notifications.md](23-quotation-notifications.md) | Notifications & Alerts | Staff alerts for approvals, views, and acceptances. |
| [24-quotation-email-and-whatsapp.md](24-quotation-email-and-whatsapp.md) | Email & WhatsApp | Multi-channel proposal delivery mechanisms. |
| [25-quotation-automation-and-crons.md](25-quotation-automation-and-crons.md) | Automation & Crons | Background crons for nudge and winback routines. |
| [26-quotation-permissions-and-role-access.md](26-quotation-permissions-and-role-access.md) | Permissions & RBAC | Role access matrix across sales and admin roles. |
| [27-quotation-database-model.md](27-quotation-database-model.md) | Database Schema | Prisma ER diagram and entity relations. |
| [28-quotation-server-actions-and-api.md](28-quotation-server-actions-and-api.md) | Server Actions & API | Action and endpoint reference index. |
| [29-quotation-validation-and-business-rules.md](29-quotation-validation-and-business-rules.md) | Validation & Rules | Zod validation schemas (`createQuoteSchema`). |
| [30-quotation-integrations.md](30-quotation-integrations.md) | Integrations | Razorpay, WhatsApp, Resend, and Puppeteer PDF. |
| [31-quotation-end-to-end-user-journeys.md](31-quotation-end-to-end-user-journeys.md) | User Journeys | Sequence diagram for proposal creation to payment. |
| [32-quotation-feature-dependency-map.md](32-quotation-feature-dependency-map.md) | Dependency Map | Upstream and downstream module connections. |
| [33-quotation-brief-vs-code-traceability.md](33-quotation-brief-vs-code-traceability.md) | Brief Traceability | Cross-reference against Autopilot Brief requirements. |
| [34-quotation-gaps-and-verification.md](34-quotation-gaps-and-verification.md) | Gaps & Verification | Factual audit matrix verifying code functionality. |
| [35-complete-quotation-feature-index.md](35-complete-quotation-feature-index.md) | Complete Feature Index | Immutable feature catalog (`QUOTE-001` - `QUOTE-012`). |

---

## Status Summary

- **Module Status**: `COMPLETE`
- **Verification**: `CODE VERIFIED` against production App Router codebase.
