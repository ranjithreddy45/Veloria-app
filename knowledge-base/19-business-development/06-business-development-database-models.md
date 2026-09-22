# 06 Business Development Database Models

`SCHEMA VERIFIED`

## Key Models in `prisma/schema.prisma`
1. `AcqLead`: `id`, `propertyName`, `ownerName`, `phone`, `email`, `city`, `locality`, `propertyType`, `status`, `bdExecutiveId`, `createdAt`, `updatedAt`.
2. `AcqLeadContact`: Primary and secondary owner contacts linked to `AcqLead`.
3. `AcqSiteVisit`: `id`, `leadId`, `visitDate`, `status`, `notes`, `rating`.
4. `AcqDeal`: `id`, `leadId`, `propertyName`, `propertyType`, `ownerName`, `city`, `locality`, `seatingTheatre`, `seatingFloating`, `stage`, `model` (MANAGEMENT, FRANCHISE), `baseFeePct`, `royaltyPct`, `expectedMonthlyRev`, `propertyId`, `createdAt`, `updatedAt`.
5. `AcqProjection`: `id`, `dealId`, `annualRevenue`, `operatingExpense`, `monthlyRent`, `baseFeeAmount`, `royaltyAmount`, `ebitda`, `paybackMonths`, `roiPct`.
6. `AcqContract`: `id`, `dealId`, `propertyId`, `contractNumber`, `status`, `currentVersion`, `totalValue`, `startDate`, `endDate`, `createdAt`, `updatedAt`.
7. `AcqContractVersion`: `id`, `contractId`, `versionNumber`, `terms`, `pdfUrl`, `signedAt`, `signedBy`.
8. `AcqProperty`: `id`, `dealId`, `venueId`, `propertyName`, `propertyType`, `city`, `locality`, `status` (ONBOARDING, PUBLISHED, INACTIVE), `acquisitionDate`, `createdAt`, `updatedAt`.
9. `AcqOnboardingProject`: `id`, `propertyId`, `status` (OPEN, IN_PROGRESS, COMPLETED), `bdOwnerId`, `dealClosedDate`.
10. `AcqOnboardingTask`: `id`, `projectId`, `title`, `isCompleted`, `dueDate`, `assignedToId`.
