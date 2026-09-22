# Module 19: Business Development & Property Acquisition

`CODE VERIFIED`

## Module Purpose
The Business Development & Property Acquisition module manages the complete growth and expansion lifecycle for Veloria Grand—from property lead discovery (`AcqLead`), site visits (`AcqSiteVisit`), acquisition deal pipeline (`AcqDeal`), financial projections & ROI calculation (`AcqProjection`), acquisition contract drafting and signing (`AcqContract`), onboarding projects (`AcqOnboardingProject`), through to automatic bookable `Venue` creation (`ensureVenueForProperty`) for booking availability.

---

## Technical & Architecture Summary

### Routes Discovered
- `/bd` or `/bd/dashboard` — BD Overview & Pipeline Analytics Dashboard
- `/bd/leads` — Property Leads Inbox & Work Strip
- `/bd/leads/[leadId]` — Property Lead Detail & Activity Log
- `/bd/properties` — Property Master Directory
- `/bd/properties/[propertyId]` — Property Detail & Onboarding Status
- `/bd/deals` — Acquisition Deals Kanban & Table
- `/bd/deals/[dealId]` — Acquisition Deal Detail & Financial Projections
- `/bd/contracts` — Acquisition Contracts Dashboard
- `/bd/contracts/[contractId]` — Acquisition Contract Detail, Versioning & Digital Signing
- `/bd/followups` — Site Visits & Meetings Calendar
- `/bd/reports` — BD Analytics & SLA Reports
- `/settings/bd-config` — BD SLA Settings & Stage Targets

### Server Actions Discovered
- `src/actions/acq-lead.actions.ts`: `getAcqLeads`, `getAcqLeadById`, `createAcqLead`, `updateAcqLeadStatus`, `convertLeadToDeal`.
- `src/actions/acq-deal.actions.ts`: `getAcqDeals`, `getAcqDealById`, `createAcqDeal`, `updateAcqDealStage`.
- `src/actions/acq-property.actions.ts`: `getAcqProperties`, `getAcqPropertyById`, `updateAcqPropertyStatus`.
- `src/actions/acq-contract.actions.ts`: `getAcqContracts`, `getAcqContractById`, `createAcqContract`, `createAcqContractVersion`, `signAcqContract`.
- `src/actions/acq-projection.actions.ts`: `getAcqProjection`, `upsertAcqProjection`.
- `src/actions/acq-visit.actions.ts` & `acq-meeting.actions.ts`: `createAcqVisit`, `updateAcqVisit`, `createAcqMeeting`.
- `src/actions/acq-analytics.actions.ts` & `acq-reports.actions.ts`: `getAcqAnalytics`, `getAcqSlaMetrics`, `getAcqPipelineReport`.

### Prisma Models Discovered
- `AcqLead`, `AcqLeadContact`, `AcqLeadActivity`, `AcqSiteVisit`, `AcqVisitNote`
- `AcqDeal`, `AcqProjection`, `AcqCapexProjection`, `AcqDealNote`, `AcqStageTransition`
- `AcqContract`, `AcqContractDocument`, `AcqContractActivity`, `AcqContractVersion`
- `AcqProperty`, `AcqEvaluation`, `AcqAttachment`, `AcqOnboardingProject`, `AcqOnboardingTask`
- `AcqConfig`, `AcqProjectionTransition`, `HallOwner`, `Venue`

### Core Downstream Handoff Summary
- `AcqLead` -> `AcqDeal`: `AUTOMATIC` (`convertLeadToDeal()`)
- `AcqDeal` (WON / SIGNED) -> `AcqProperty` (`status: ONBOARDING`): `AUTOMATIC` (`ensureDealProperty()`)
- `AcqDeal` (WON / SIGNED) -> `AcqOnboardingProject` & `ONBOARDING_SEED_TASKS`: `AUTOMATIC` (`ensureDealProperty()`)
- `AcqDeal` (WON / SIGNED) -> `HallOwner` CRM Record: `AUTOMATIC` (`ensureDealHallOwner()`)
- `AcqProperty` (`status: PUBLISHED`) -> `Venue` (Bookable in Calendar): `AUTOMATIC` (`ensureVenueForProperty()`)
- `Venue` -> `Quote` / `Booking` Availability: `AUTOMATIC` (Appears in sales dropdowns)

---

## Document Index
1. `01-business-development-overview.md` — Business Development Subsystem Overview
2. `02-business-development-business-purpose.md` — Strategic Purpose & Business Goals
3. `03-business-development-route-map.md` — Complete Navigation & Screen Index
4. `04-business-development-server-actions.md` — Server Actions Reference
5. `05-business-development-api-map.md` — API Endpoints & Cron Jobs
6. `06-business-development-database-models.md` — Prisma Database Schemas
7. `07-business-development-enums.md` — Status & Stage Enums
8. `08-property-discovery.md` — Property Discovery & Intake
9. `09-property-leads.md` — Property Lead Management
10. `10-property-pipeline.md` — Lead Pipeline Stages
11. `11-property-master.md` — Property Master Record
12. `12-property-contacts.md` — Property Owner Contacts
13. `13-property-visits.md` — Site Visit Management
14. `14-property-evaluation.md` — Structural & Facility Evaluation
15. `15-property-scoring.md` — Rating & Scoring Formulas
16. `16-acquisition-pipeline.md` — Acquisition Deal Pipeline
17. `17-acquisition-record.md` — Deal Commercial Models
18. `18-acquisition-negotiation.md` — Terms & Projection Revision
19. `19-acquisition-approval.md` — Deal Approval Gates
20. `20-acquisition-contract.md` — Acquisition Contract Management
21. `21-acquisition-contract-versioning.md` — Contract Version Audit Trail
22. `22-property-contract-signing.md` — Contract Signing & Property Trigger
23. `23-acquisition-to-venue.md` — `ensureVenueForProperty()` Bridge
24. `24-venue-master-handoff.md` — Venue Master Field Mapping
25. `25-property-to-booking.md` — Sales Booking Availability
26. `26-property-to-operations.md` — Operations Onboarding Checklist
27. `27-property-to-finance.md` — Finance & Payout Integration
28. `28-property-commercial-terms.md` — Commercial Models & Royalties
29. `29-property-documents.md` — Document Attachments
30. `30-property-due-diligence.md` — Legal & Structural Due Diligence
31. `31-property-legal-review.md` — Legal Review Workflow
32. `32-property-finance-review.md` — Financial Projections & ROI
33. `33-acquisition-status.md` — Deal & Property Status Lifecycles
34. `34-acquisition-cancellation.md` — Lost Deals & Reason Tracking
35. `35-property-follow-up.md` — Follow-up Meetings & Visits
36. `36-business-development-notifications.md` — SLA & Escalation Notifications
37. `37-business-development-crons.md` — SLA & Contract Cron Jobs
38. `38-business-development-rbac.md` — RBAC & Permission Gates
39. `39-property-data-scoping.md` — Executive Data Scoping
40. `40-property-audit-trail.md` — Stage Transition Audit Trail
41. `41-business-development-reporting.md` — Pipeline & Conversion Reports
42. `42-business-development-analytics.md` — Cycle Time & SLA Analytics
43. `43-property-search-filtering.md` — Search & Filter Controls
44. `44-property-export.md` — Data Export Options
45. `45-property-document-access.md` — Document Security & Permissions
46. `46-property-legal-entity.md` — Legal Entity Assignment
47. `47-property-tax-configuration.md` — Tax Jurisdiction Setup
48. `48-contract-finance-chain.md` — Contract to Finance Chain
49. `49-property-venue-booking-finance-chain.md` — End-to-End Financial Chain
50. `50-property-operations-chain.md` — End-to-End Operations Chain
51. `51-business-development-sales-handoff.md` — BD to Sales Handoff
52. `52-acquisition-vs-sales-contract.md` — Acquisition vs Sales Contract Comparison
53. `53-brief-vs-code.md` — Product Brief vs Code Discrepancies
54. `54-business-development-gaps.md` — Gap Analysis
55. `55-business-development-manual-verification.md` — Manual Verification Protocol
56. `56-end-to-end-business-development-journeys.md` — End-to-End User Journeys
57. `57-business-development-dependency-map.md` — System Dependency Graph
58. `58-acquisition-state-machines.md` — State Machine Registers
59. `59-business-development-data-flow.md` — Data Flow Diagrams
60. `60-property-acquisition-handoff-matrix.md` — Data Handoff Destination Matrix
61. `61-business-development-test-matrix.md` — Static Audit Test Matrix
62. `62-complete-business-development-feature-index.md` — Complete Feature & Action Index

---

CHUNK 19 STATUS: COMPLETE
