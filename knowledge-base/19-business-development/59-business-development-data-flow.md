# 59 BD Data Flow

`CODE VERIFIED`

```
AcqLead Input
  |
  +---> convertLeadToDeal()
           |
           v
        AcqDeal (Stage: PROSPECT -> WON)
           |
           +---> upsertAcqProjection() (ROI, Payback Months)
           +---> createAcqContract() & signAcqContract()
                    |
                    v
        ensureDealProperty()
           |
           +---> AcqProperty (Status: ONBOARDING)
           +---> AcqOnboardingProject & Tasks
           +---> HallOwner Record
                    |
                    v (Status: PUBLISHED)
        ensureVenueForProperty()
           |
           v
        Venue (Active in Booking Calendar)
```
