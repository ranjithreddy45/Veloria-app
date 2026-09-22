# 60 Property Acquisition Handoff Matrix

`CODE VERIFIED`

| Source Model / Action | Destination Model | Handoff Type | Triggering Function | Verification Details |
|---|---|---|---|---|
| `AcqLead` | `AcqDeal` | `AUTOMATIC` | `convertLeadToDeal()` | Creates deal in `PROSPECT` stage |
| `AcqDeal` (WON / SIGNED) | `AcqProperty` | `AUTOMATIC` | `ensureDealProperty()` | Creates property in `ONBOARDING` status |
| `AcqDeal` (WON / SIGNED) | `AcqOnboardingProject` | `AUTOMATIC` | `ensureDealProperty()` | Creates project with `ONBOARDING_SEED_TASKS` |
| `AcqDeal` (WON / SIGNED) | `HallOwner` | `AUTOMATIC` | `ensureDealHallOwner()` | Creates Hall Owner CRM record |
| `AcqProperty` (PUBLISHED) | `Venue` | `AUTOMATIC` | `ensureVenueForProperty()` | Creates bookable `Venue` in database |
| `Venue` | `Quote` / `Booking` | `AUTOMATIC` | Selection in UI | Appears in venue dropdowns for sales |
