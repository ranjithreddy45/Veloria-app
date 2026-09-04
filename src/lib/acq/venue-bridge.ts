// ============================================================
// BD → Bookings bridge: every published property must have a bookable Venue.
// ------------------------------------------------------------
// Lives in lib/ (NOT an actions file): it takes a Prisma transaction client,
// so it can only ever be called from server code that is already inside a
// transaction — exporting it from a "use server" module made it a public
// endpoint shape it could never honour.
// Idempotent — if property.venueId is already set, it's a no-op (never creates
// a second venue for the same property).
// ============================================================

import { Prisma } from "@prisma/client";

export type EnsureVenueProperty = {
  id: string;
  venueId: string | null;
  propertyName: string;
  city: string;
  locality: string;
  address: string | null;
  seatingTheatre: number | null;
  seatingFloating: number | null;
};

export async function ensureVenueForProperty(
  tx: Prisma.TransactionClient,
  property: EnsureVenueProperty,
): Promise<string> {
  // Idempotency guard #1: in-memory — property already carries a venue id.
  if (property.venueId) return property.venueId;

  // Idempotency guard #2: re-read inside the tx in case venueId was set
  // concurrently (the in-param may be stale).
  const fresh = await tx.acqProperty.findUnique({
    where: { id: property.id },
    select: { venueId: true },
  });
  if (fresh?.venueId) return fresh.venueId;

  const capacity = property.seatingTheatre ?? property.seatingFloating ?? 0;
  const venue = await tx.venue.create({
    data: {
      name: property.propertyName,
      description: [property.address, property.locality, property.city].filter(Boolean).join(", ") || null,
      capacity,
      pricePerSlot: 0,
      amenities: [],
      isActive: true,
    },
  });
  await tx.acqProperty.update({ where: { id: property.id }, data: { venueId: venue.id } });
  return venue.id;
}
