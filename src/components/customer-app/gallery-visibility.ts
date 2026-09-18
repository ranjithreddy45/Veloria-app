// ============================================================
// What a gallery item's settings mean for customers, in words for the team.
// The customer app reads GalleryItem rows directly (getGuestPhotos): public
// PHOTO items appear in its gallery and home screen, and on a hall's page and
// card when the item is linked to that hall.
// ============================================================

export function customerAppVisibility({ isPublic, mediaType, venueName }: { isPublic: boolean; mediaType: string; venueName: string | null }): string {
  if (!isPublic) return "Private: customers don't see this.";
  if (mediaType !== "PHOTO") return "Public, but the customer app only shows photos.";
  return venueName
    ? `Customers see this in the app gallery and on the ${venueName} page.`
    : "Customers see this in the app gallery. Choose a hall to show it on that hall's page too.";
}
