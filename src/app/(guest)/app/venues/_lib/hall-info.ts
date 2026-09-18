// ============================================================
// Practical hall information for customer screens — pure helpers.
//
// Staff type these values into the venue editor, so every URL is re-checked
// here: only plain web addresses become links (never javascript:, data: or
// mailto:), and empty values stay null so the screen hides the section.
// ============================================================

/** Trimmed text, or null when empty. */
export function textOrNull(v: string | null | undefined): string | null {
  const s = v?.trim();
  return s ? s : null;
}

const SCHEME = /^[a-z][a-z0-9+.-]*:(?!\d)/i;
const BARE_HOST = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[:/?#]|$)/i;

/** A web address as an absolute http(s) URL, or null when it isn't one. Accepts "maps.app.goo.gl/…" without a scheme. */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  const s = textOrNull(raw);
  if (!s) return null;
  let candidate: string;
  if (/^https?:\/\//i.test(s)) candidate = s;
  else if (s.startsWith("//")) candidate = `https:${s}`;
  else if (!SCHEME.test(s) && BARE_HOST.test(s)) candidate = `https://${s}`;
  else return null;
  try {
    const u = new URL(candidate);
    if ((u.protocol !== "https:" && u.protocol !== "http:") || !u.hostname.includes(".")) return null;
    return u.href;
  } catch {
    return null;
  }
}

/** Google Maps search for an address. */
export function mapsSearchHref(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export interface ResolvedAddress {
  /** HALL = this hall's own address; VENUE = the venue-wide address from Settings → Business contact. */
  source: "HALL" | "VENUE";
  text: string | null;
  mapHref: string | null;
}

/**
 * The address to show on a hall's page. The hall's own address or map link
 * wins; the venue-wide BusinessProfile address is used only when the hall has
 * neither (the screen labels it as the venue address). Nothing → null.
 */
export function resolveHallAddress(
  hall: { publicAddress?: string | null; mapUrl?: string | null },
  venue: { address?: string | null; mapUrl?: string | null } | null
): ResolvedAddress | null {
  const hallText = textOrNull(hall.publicAddress);
  const hallMap = safeHttpUrl(hall.mapUrl);
  if (hallText || hallMap) {
    return { source: "HALL", text: hallText, mapHref: hallMap ?? (hallText ? mapsSearchHref(hallText) : null) };
  }
  const venueText = textOrNull(venue?.address);
  const venueMap = safeHttpUrl(venue?.mapUrl);
  if (venueText || venueMap) {
    return { source: "VENUE", text: venueText, mapHref: venueMap ?? (venueText ? mapsSearchHref(venueText) : null) };
  }
  return null;
}
