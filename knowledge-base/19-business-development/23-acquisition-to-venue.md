# 23 Acquisition to Venue Handoff

`CODE VERIFIED`

- Single source of truth: `ensureVenueForProperty()` in `src/lib/acq/venue-bridge.ts`.
- Triggered when property status transitions to `PUBLISHED` (or manually invoked).
- Creates `Venue` record (`name = property.propertyName`, `capacity = seatingTheatre ?? seatingFloating`, `isActive = true`) and updates `AcqProperty.venueId = venue.id`.
