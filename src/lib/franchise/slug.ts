// ============================================================
// Franchise white-label storefront slug helpers (pure, no IO)
// ============================================================
// A FranchiseVenue.storefrontSlug doubles as the public access token for the
// white-label storefront at /s/<slug>. It must therefore be safely slugified
// AND must never collide with an existing top-level app path, otherwise a
// partner could shadow /app, /pay, /api, etc.

/**
 * Reserved top-level path segments that a storefront slug must never equal.
 * Keep in sync with the route groups in src/app/(public) and (dashboard).
 */
export const RESERVED_SLUGS: readonly string[] = [
  "app",
  "pay",
  "form",
  "rsvp",
  "r",
  "s",
  "sign",
  "sign-in",
  "sign-up",
  "configure",
  "hold",
  "dashboard",
  "api",
  "settings",
  "franchise",
  "admin",
  "auth",
  "_next",
  "favicon",
  "robots",
  "sitemap",
];

/**
 * Convert a free-text name into a URL-safe storefront slug.
 * lowercase, spaces/underscores → dashes, strip non-alphanumerics,
 * collapse repeated dashes, trim leading/trailing dashes.
 */
export function toStorefrontSlug(name: string): string {
  return (name ?? "")
    .toString()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 60);
}

/**
 * True when a slug collides with a reserved app path and so must be rejected.
 */
export function isReservedSlug(slug: string): boolean {
  const normalized = (slug ?? "").trim().toLowerCase();
  if (!normalized) return true;
  return RESERVED_SLUGS.includes(normalized);
}

/**
 * Validate a candidate slug: non-empty, well-formed, not reserved.
 * Returns null when valid, or a human-readable error string otherwise.
 */
export function validateStorefrontSlug(slug: string): string | null {
  const normalized = (slug ?? "").trim().toLowerCase();
  if (!normalized) return "Slug is required.";
  if (normalized.length < 3) return "Slug must be at least 3 characters.";
  if (normalized.length > 60) return "Slug must be at most 60 characters.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    return "Slug may contain only lowercase letters, numbers and dashes.";
  }
  if (isReservedSlug(normalized)) {
    return "This slug is reserved. Please choose another.";
  }
  return null;
}
