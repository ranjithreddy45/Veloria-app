"use server";

// ============================================================
// Storefront actions — PUBLIC (no auth)
// ============================================================
// Powers the guest-facing mobile app at /app. These are intentionally
// unauthenticated: anyone browsing venues or sending an enquiry.

import { prisma } from "@/lib/prisma";
import { captureLeadFromExternal } from "@/lib/lead-capture";
import { serialize } from "@/lib/utils";

export interface StorefrontVenue {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  pricePerSlot: number;
  amenities: string[];
}

/**
 * List active venues for the public storefront, including price + amenities.
 */
export async function getStorefrontVenues(): Promise<StorefrontVenue[]> {
  try {
    const venues = await prisma.venue.findMany({
      where: { isActive: true, parentVenueId: null },
      select: {
        id: true,
        name: true,
        description: true,
        capacity: true,
        pricePerSlot: true,
        amenities: true,
      },
      orderBy: { capacity: "asc" },
    });
    return serialize(venues) as StorefrontVenue[];
  } catch (error) {
    console.error("[STOREFRONT_VENUES_ERROR]", error);
    return [];
  }
}

/**
 * Get one venue's public detail.
 */
export async function getStorefrontVenue(
  id: string
): Promise<StorefrontVenue | null> {
  try {
    const venue = await prisma.venue.findFirst({
      where: { id, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        capacity: true,
        pricePerSlot: true,
        amenities: true,
      },
    });
    return venue ? (serialize(venue) as StorefrontVenue) : null;
  } catch (error) {
    console.error("[STOREFRONT_VENUE_ERROR]", error);
    return null;
  }
}

export interface BookingInquiryInput {
  name: string;
  phone: string;
  email?: string;
  eventType?: string;
  eventDate?: string;
  guestCount?: number;
  venueId?: string;
  venueName?: string;
  message?: string;
}

/**
 * Submit a guest booking enquiry. Creates a real CRM lead (via the same
 * pipeline used by Facebook/Google capture) AND a WidgetInquiry record,
 * so the sales team sees it immediately and auto-welcome fires.
 */
export async function submitBookingInquiry(
  input: BookingInquiryInput
): Promise<{ success: boolean; error?: string }> {
  try {
    // Basic validation (kept lightweight for a public endpoint)
    const name = input.name?.trim();
    const phone = input.phone?.trim();
    if (!name || name.length < 2) {
      return { success: false, error: "Please enter your name." };
    }
    if (!phone || phone.replace(/\D/g, "").length < 7) {
      return { success: false, error: "Please enter a valid phone number." };
    }

    const messageParts: string[] = [];
    if (input.venueName) messageParts.push(`Venue: ${input.venueName}`);
    if (input.eventType) messageParts.push(`Occasion: ${input.eventType}`);
    if (input.eventDate) messageParts.push(`Date: ${input.eventDate}`);
    if (input.guestCount) messageParts.push(`Guests: ${input.guestCount}`);
    if (input.message) messageParts.push(input.message);
    const composedMessage =
      messageParts.join(" · ") || "Enquiry from Veloria Grand app";

    // 1. Store the raw inquiry (visible under Inquiries in the CRM)
    await prisma.widgetInquiry.create({
      data: {
        name,
        email: input.email?.trim() || `${phone}@noemail.veloria`,
        phone,
        eventType: input.eventType || null,
        eventDate: input.eventDate ? new Date(input.eventDate) : null,
        guestCount: input.guestCount || null,
        venueId: input.venueId || null,
        message: composedMessage,
        source: "WIDGET",
      },
    });

    // 2. Create a real lead in the pipeline (contact + lead + auto-assign
    //    + auto-welcome). Non-fatal if it fails — the inquiry is already saved.
    try {
      await captureLeadFromExternal({
        name,
        email: input.email?.trim() || undefined,
        phone,
        source: "website",
        eventType: input.eventType,
        eventDate: input.eventDate,
        guestCount: input.guestCount,
        message: composedMessage,
      });
    } catch (e) {
      console.error("[STOREFRONT_LEAD_CAPTURE_ERROR]", e);
    }

    return { success: true };
  } catch (error) {
    console.error("[SUBMIT_BOOKING_INQUIRY_ERROR]", error);
    return {
      success: false,
      error: "Something went wrong. Please try again or call us.",
    };
  }
}
