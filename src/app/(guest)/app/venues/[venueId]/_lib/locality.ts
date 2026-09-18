// ============================================================
// The short "where" that sits next to a hall's capacity in the title block.
//
// It is never invented: it is the last named part of the address the team
// typed into the hall's public address, with a trailing PIN code and a
// trailing country dropped. A one-line address has nothing to narrow down
// to, so it returns null and the title block simply omits the place — the
// full address still appears under "Getting here".
// ============================================================

const DIGITS_ONLY = /^[\d\s-]+$/;
const COUNTRY = /^(?:india|bharat|in)$/i;
const TRAILING_PIN = /[\s,-]*\b\d{6}\b\s*$/;

/** Longest we will print inline; anything longer is an address line, not a place. */
const MAX_LENGTH = 32;

/** The locality from a team-typed address, or null when the address does not name one. */
export function addressLocality(address: string | null | undefined): string | null {
  const parts = (address ?? "")
    .split(/[,\n]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;

  for (let i = parts.length - 1; i >= 1; i--) {
    const part = parts[i].replace(TRAILING_PIN, "").trim();
    if (!part || DIGITS_ONLY.test(part) || COUNTRY.test(part)) continue;
    if (part.length > MAX_LENGTH) continue;
    return part;
  }
  return null;
}
