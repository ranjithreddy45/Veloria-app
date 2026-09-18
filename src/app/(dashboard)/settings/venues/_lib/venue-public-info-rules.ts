// ============================================================
// Hall practical information — pure and client-safe.
// What Settings → Venues saves for the customer hall page. Every field is
// optional: an empty field is stored as null and hidden from customers.
// ============================================================

import { cleanText, collectResults, normalizeWebUrl, type Validated } from "../../business-contact/_lib/contact-rules";

export const VENUE_PUBLIC_INFO_FIELDS = ["publicAddress", "mapUrl", "parkingInfo", "directionsNote", "videoUrl", "virtualTourUrl"] as const;
export type VenuePublicInfoField = (typeof VENUE_PUBLIC_INFO_FIELDS)[number];
export type VenuePublicInfoInput = Partial<Record<VenuePublicInfoField, string | null>>;
export type VenuePublicInfo = Record<VenuePublicInfoField, string | null>;

export const VENUE_PUBLIC_INFO_LABELS: Record<VenuePublicInfoField, string> = {
  publicAddress: "Address shown to customers",
  mapUrl: "Google Maps link",
  parkingInfo: "Parking",
  directionsNote: "Directions",
  videoUrl: "Video link",
  virtualTourUrl: "Virtual tour link",
};

export function validateVenuePublicInfoInput(input: VenuePublicInfoInput | null | undefined): Validated<VenuePublicInfoField> {
  const i = input ?? {};
  return collectResults<VenuePublicInfoField>({
    publicAddress: cleanText(i.publicAddress, 500, "Address"),
    mapUrl: normalizeWebUrl(i.mapUrl, "Google Maps link"),
    parkingInfo: cleanText(i.parkingInfo, 1000, "Parking information"),
    directionsNote: cleanText(i.directionsNote, 1000, "Directions"),
    videoUrl: normalizeWebUrl(i.videoUrl, "Video link"),
    virtualTourUrl: normalizeWebUrl(i.virtualTourUrl, "Virtual tour link"),
  });
}

/** How many of the six fields have something customers will see. */
export function countFilledPublicInfo(info: Partial<Record<VenuePublicInfoField, string | null | undefined>>): number {
  return VENUE_PUBLIC_INFO_FIELDS.filter((f) => typeof info[f] === "string" && (info[f] as string).trim() !== "").length;
}
