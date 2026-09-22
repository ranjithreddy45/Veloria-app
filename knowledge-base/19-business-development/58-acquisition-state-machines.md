# 58 Acquisition State Machine Register

`CODE VERIFIED`

- **AcqLead Status**: `NEW` -> `CONTACTED` -> `QUALIFIED` -> `CONVERTED` / `UNQUALIFIED`.
- **AcqDeal Stage**: `PROSPECT` -> `QUALIFIED` -> `LOI_SENT` -> `PROPOSAL_SENT` -> `NEGOTIATING` -> `WON` (triggers `ensureDealProperty`) / `LOST`.
- **AcqContract Status**: `DRAFT` -> `IN_REVIEW` -> `APPROVED` -> `SENT` -> `SIGNED` (triggers `ensureDealProperty`) / `REJECTED` / `EXPIRED` / `TERMINATED`.
- **AcqProperty Status**: `ONBOARDING` -> `PUBLISHED` (triggers `ensureVenueForProperty`) -> `INACTIVE`.
