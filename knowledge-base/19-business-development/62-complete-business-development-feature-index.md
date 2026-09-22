# 62 Complete Business Development Feature Index

`CODE VERIFIED`

| Feature | Route | Server Action / Component | Models Used | RBAC Permission | Status |
|---|---|---|---|---|---|
| BD Dashboard | `/bd` | `getAcqAnalytics()` | `AcqDeal`, `AcqProperty` | `bd:read` | `IMPLEMENTED` |
| Lead Inbox | `/bd/leads` | `getAcqLeads()`, `createAcqLead()` | `AcqLead`, `AcqLeadContact` | `bd:read` / `write` | `IMPLEMENTED` |
| Lead Detail | `/bd/leads/[id]` | `getAcqLeadById()`, `convertLeadToDeal()` | `AcqLead`, `AcqDeal` | `bd:read` / `write` | `IMPLEMENTED` |
| Property List | `/bd/properties` | `getAcqProperties()` | `AcqProperty` | `bd:read` | `IMPLEMENTED` |
| Property Detail | `/bd/properties/[id]` | `getAcqPropertyById()`, `updateAcqPropertyStatus()` | `AcqProperty`, `AcqOnboardingProject`, `Venue` | `bd:read` / `write` | `IMPLEMENTED` |
| Deals Kanban | `/bd/deals` | `getAcqDeals()`, `createAcqDeal()`, `updateAcqDealStage()` | `AcqDeal`, `AcqProperty` | `bd:read` / `write` | `IMPLEMENTED` |
| Financial Projections | `/bd/deals/[id]` | `getAcqProjection()`, `upsertAcqProjection()` | `AcqProjection`, `AcqDeal` | `bd:read` / `write` | `IMPLEMENTED` |
| Contracts Dashboard | `/bd/contracts` | `getAcqContracts()`, `createAcqContract()` | `AcqContract`, `AcqContractVersion` | `bd:read` / `write` | `IMPLEMENTED` |
| Contract Detail & Sign | `/bd/contracts/[id]` | `getAcqContractById()`, `signAcqContract()` | `AcqContract`, `AcqProperty` | `bd:read` / `write` | `IMPLEMENTED` |
| Followups & Visits | `/bd/followups` | `createAcqVisit()`, `createAcqMeeting()` | `AcqSiteVisit`, `AcqMeeting` | `bd:read` / `write` | `IMPLEMENTED` |
| BD Reports | `/bd/reports` | `getAcqPipelineReport()` | `AcqDeal`, `AcqProperty` | `bd:read` | `IMPLEMENTED` |
| SLA Cron | `/api/cron/acq-sla` | Route Handler | `AcqDeal` | Cron Secret | `IMPLEMENTED` |
