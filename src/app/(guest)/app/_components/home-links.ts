// ============================================================
// Where the home screen sends people to browse.
//
// The feed owns what a hall search is and how it is written into a URL
// (venues/_lib/hall-search.ts). The home screen's search entry and its size
// chips go through this one file, so a search started on the home screen
// opens exactly the feed a search started inside the feed would — same
// parameter names, same validation, same shareable link.
// ============================================================

import { EMPTY_HALL_SEARCH, hallSearchHref, type HallSearch } from "../venues/_lib/hall-search";

/**
 * /app/venues, filtered by whatever the home screen was asked for. Home
 * always starts from an empty search — there is no search in progress here —
 * so `patch` alone decides the link; fields left out stay unfiltered rather
 * than being written as empty parameters.
 */
export function browseHref(patch: Partial<HallSearch> = {}): string {
  return hallSearchHref("/app/venues", EMPTY_HALL_SEARCH, patch);
}
