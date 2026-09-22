# 04 Business Development Server Actions

`CODE VERIFIED`

## 1. `src/actions/acq-lead.actions.ts`
- `getAcqLeads()`: List property leads with status filters.
- `getAcqLeadById(id)`: Fetch single property lead.
- `createAcqLead(input)`: Create new `AcqLead`.
- `updateAcqLeadStatus(id, status)`: Update lead status (`NEW` -> `CONTACTED` -> `QUALIFIED` -> `CONVERTED`).
- `convertLeadToDeal(leadId)`: Convert qualified lead into `AcqDeal`.

## 2. `src/actions/acq-deal.actions.ts`
- `getAcqDeals()`: List acquisition deals.
- `getAcqDealById(id)`: Fetch deal with projections and notes.
- `createAcqDeal(input)`: Create new `AcqDeal`.
- `updateAcqDealStage(id, stage)`: Update deal stage (`PROSPECT` -> `QUALIFIED` -> `LOI_SENT` -> `PROPOSAL_SENT` -> `NEGOTIATING` -> `WON` -> `LOST`). On `WON`, invokes `ensureDealProperty()`.

## 3. `src/actions/acq-property.actions.ts`
- `getAcqProperties()`: List acquired properties.
- `getAcqPropertyById(id)`: Fetch property detail.
- `updateAcqPropertyStatus(id, status)`: Update property status (`ONBOARDING` -> `PUBLISHED` -> `INACTIVE`). On `PUBLISHED`, invokes `ensureVenueForProperty()`.

## 4. `src/actions/acq-contract.actions.ts`
- `getAcqContracts()`: List acquisition contracts.
- `getAcqContractById(id)`: Fetch contract with version history (`AcqContractVersion`).
- `createAcqContract(data)`: Create `AcqContract`.
- `createAcqContractVersion(contractId, data)`: Draft new contract version.
- `signAcqContract(contractId, data)`: Sign contract, update status to `SIGNED`, and invoke `ensureDealProperty()`.

## 5. `src/actions/acq-projection.actions.ts`
- `getAcqProjection(dealId)`: Fetch financial projection for deal.
- `upsertAcqProjection(dealId, data)`: Calculate ROI, payback, EBITDA using `src/lib/acq/projection-calc.ts`.

## 6. `src/actions/acq-visit.actions.ts` & `acq-meeting.actions.ts`
- `createAcqVisit()`, `updateAcqVisit()`, `createAcqMeeting()`.

## 7. `src/actions/acq-analytics.actions.ts` & `acq-reports.actions.ts`
- `getAcqAnalytics()`, `getAcqSlaMetrics()`, `getAcqPipelineReport()`.
