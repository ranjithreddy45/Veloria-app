"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";
import { diffFields, type FieldErrors } from "@/app/(dashboard)/settings/business-contact/_lib/contact-rules";
import {
  validateVenuePublicInfoInput,
  type VenuePublicInfo,
  type VenuePublicInfoField,
  type VenuePublicInfoInput,
} from "@/app/(dashboard)/settings/venues/_lib/venue-public-info-rules";

// ============================================================
// Settings → Venues → practical information for the customer hall page
// (address, map, parking, directions, video, virtual tour). Kept apart from
// the shared updateVenue action; same permission (settings:venues).
// ============================================================

export async function updateVenuePublicInfo(
  venueId: string,
  input: VenuePublicInfoInput
): Promise<
  | { success: true; data: { changed: boolean; info: VenuePublicInfo } }
  | { success: false; error: string; fieldErrors?: FieldErrors<VenuePublicInfoField> }
> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (!hasPermission(session.user.role, "settings:venues")) return { success: false, error: "Insufficient permissions" };
  if (typeof venueId !== "string" || !venueId) return { success: false, error: "Venue not found" };

  const parsed = validateVenuePublicInfoInput(input);
  if (!parsed.ok) return { success: false, error: "Please fix the highlighted fields.", fieldErrors: parsed.errors };

  try {
    const before = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, publicAddress: true, mapUrl: true, parkingInfo: true, directionsNote: true, videoUrl: true, virtualTourUrl: true },
    });
    if (!before) return { success: false, error: "Venue not found" };

    const changes = diffFields(before, parsed.data);
    if (Object.keys(changes).length === 0) return { success: true, data: { changed: false, info: parsed.data } };

    await prisma.venue.update({ where: { id: venueId }, data: parsed.data });
    await logActivity({ userId: session.user.id, action: "updated", entityType: "Venue", entityId: venueId, changes: { publicInfo: changes } });

    revalidatePath("/settings/venues");
    revalidatePath("/app/venues");
    revalidatePath(`/app/venues/${venueId}`);
    return { success: true, data: { changed: true, info: parsed.data } };
  } catch (error) {
    console.error("[UPDATE_VENUE_PUBLIC_INFO_ERROR]", error);
    return { success: false, error: "Failed to update the hall's customer information" };
  }
}
