# 01 Business Development Subsystem Overview

`CODE VERIFIED`

## Architecture & Subsystem Boundaries

The Veloria Grand Business Development & Property Acquisition subsystem manages the complete property expansion lifecycle from property lead discovery, site visits, evaluation, financial projections, deal pipeline negotiations, acquisition contracts, onboarding projects, hall owner CRM records, through to automatic `Venue` creation (`ensureVenueForProperty`) for booking availability.

```
+-----------------------------------------------------------------------------------+
|                            PROPERTY LEAD DISCOVERY                                |
|                         (/bd/leads - AcqLead, AcqLeadContact)                     |
+-----------------------------------------------------------------------------------+
                                         | Convert Lead to Deal
                                         v
+-----------------------------------------------------------------------------------+
|                           ACQUISITION DEAL PIPELINE                               |
|                         (/bd/deals - AcqDeal, AcqProjection)                      |
|       Stages: PROSPECT -> QUALIFIED -> LOI_SENT -> PROPOSAL_SENT                  |
|               -> NEGOTIATING -> WON / LOST                                        |
+-----------------------------------------------------------------------------------+
                                         | Win Deal / Sign Contract
                                         v
+-----------------------------------------------------------------------------------+
|                        CONTRACTS & ONBOARDING CONVERSION                          |
|                       (/bd/contracts - AcqContract, AcqProperty)                  |
|                                                                                   |
|  1. ensureDealProperty() -> Creates AcqProperty (status: ONBOARDING)              |
|  2. Creates AcqOnboardingProject & AcqOnboardingTask (Capex, Legal, Kitchen)      |
|  3. Creates HallOwner record                                                      |
+-----------------------------------------------------------------------------------+
                                         | Publish Property
                                         v
+-----------------------------------------------------------------------------------+
|                        VENUE BRIDGE & BOOKING AVAILABILITY                        |
|                  ensureVenueForProperty() -> Creates Venue model                  |
|                        (Available for Sales Quotations & Bookings)                |
+-----------------------------------------------------------------------------------+
```

## Key Implemented Modules
1. **Property Lead Management**: `AcqLead` (`NEW`, `CONTACTED`, `QUALIFIED`, `CONVERTED`, `UNQUALIFIED`) and `AcqLeadContact`.
2. **Site Visits & Meetings**: `AcqSiteVisit` and `AcqVisitNote`.
3. **Acquisition Deal Pipeline**: `AcqDeal` (`PROSPECT`, `QUALIFIED`, `LOI_SENT`, `PROPOSAL_SENT`, `NEGOTIATING`, `WON`, `LOST`) with commercial models (`MANAGEMENT`, `FRANCHISE`).
4. **Financial Projections**: `AcqProjection` and `AcqCapexProjection` with revenue share/base fee ROI calculations (`src/lib/acq/projection-calc.ts`).
5. **Acquisition Contracts**: `AcqContract` (`DRAFT`, `IN_REVIEW`, `APPROVED`, `SENT`, `SIGNED`, `REJECTED`, `EXPIRED`, `TERMINATED`) and `AcqContractVersion`.
6. **Property Master**: `AcqProperty` (`ONBOARDING`, `PUBLISHED`, `INACTIVE`).
7. **Onboarding Projects**: `AcqOnboardingProject` and `AcqOnboardingTask`.
8. **Venue Bridge**: `ensureVenueForProperty()` in `src/lib/acq/venue-bridge.ts`.
