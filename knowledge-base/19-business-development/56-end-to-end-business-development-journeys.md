# 56 End-to-End BD Journeys

`CODE VERIFIED`

- **Journey 1 (Discovery to Deal)**: BD Executive enters `AcqLead` -> Schedules Site Visit (`AcqSiteVisit`) -> Qualifies Lead -> Converts to `AcqDeal` (`PROSPECT`).
- **Journey 2 (Deal to Onboarding)**: Run Projections (`upsertAcqProjection`) -> Draft Contract (`AcqContract`) -> Sign Contract (`signAcqContract`) -> `ensureDealProperty()` creates `AcqProperty` (`ONBOARDING`) & `AcqOnboardingProject`.
- **Journey 3 (Publish to Booking)**: Complete Onboarding Tasks -> Update Property Status to `PUBLISHED` -> `ensureVenueForProperty()` creates `Venue` -> Available in Sales Quotations.
