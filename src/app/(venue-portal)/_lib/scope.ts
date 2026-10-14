import { cache } from "react";
import { getVenuePortalScope } from "@/lib/venue-owner/portal-data";

// ============================================================
// One scope lookup per request. The layout needs the scope for its header and
// the page needs it for its data; React's cache() lets both ask without a
// second VenueOwnerAccess query. Server components only.
// ============================================================

export const getPortalScope = cache(getVenuePortalScope);
