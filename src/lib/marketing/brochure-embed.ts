// ============================================================
// Digital brochure — pure embed-safety + slug helpers (no IO).
// ------------------------------------------------------------
// Shared by the zod schema, both action files (validation), and the iframe
// renderer (defence-in-depth). videoEmbedUrl / tour360Url are operator-supplied
// and rendered inside a sandboxed iframe, so we hard-allowlist the hosts to
// block embed-injection / clickjacking (see digital-brochure risks).
// ============================================================

/**
 * Allowlisted embed hosts. Only these (and their exact sub-hosts below) may be
 * placed in an <iframe>. Anything else is rejected at validation AND render.
 */
export const ALLOWED_EMBED_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "vimeo.com",
  "www.vimeo.com",
  "player.vimeo.com",
  "matterport.com",
  "www.matterport.com",
  "my.matterport.com",
] as const;

/** Normalise a host: lowercase, strip a leading "www." for comparison. */
function bareHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

const ALLOWED_BARE = new Set(ALLOWED_EMBED_HOSTS.map(bareHost));

/**
 * True only for an https URL whose host is on the allowlist. Returns false for
 * any malformed input, non-https scheme, or off-allowlist host. Pure + safe to
 * call on untrusted strings.
 */
export function isAllowedEmbedUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  return ALLOWED_BARE.has(bareHost(parsed.hostname));
}

/**
 * Convert an operator-supplied watch/share URL into a host-allowlisted
 * embeddable URL. Returns null if the host isn't allowlisted (so the caller
 * simply omits the iframe). Handles the common youtube watch?v= / youtu.be
 * short-link / vimeo /<id> shapes; Matterport URLs are already embed-shaped.
 */
export function toEmbedUrl(url: string | null | undefined): string | null {
  if (!isAllowedEmbedUrl(url)) return null;
  const parsed = new URL((url as string).trim());
  const host = bareHost(parsed.hostname);

  // YouTube — youtu.be/<id> or youtube.com/watch?v=<id> → /embed/<id>.
  if (host === "youtu.be") {
    const id = parsed.pathname.replace(/^\//, "").split("/")[0];
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (parsed.pathname.startsWith("/embed/")) return parsed.toString();
    const id = parsed.searchParams.get("v");
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
  }

  // Vimeo — vimeo.com/<id> → player.vimeo.com/video/<id>.
  if (host === "vimeo.com") {
    const id = parsed.pathname.replace(/^\//, "").split("/")[0];
    return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  }
  if (host === "player.vimeo.com") return parsed.toString();

  // Matterport — already an embed-shaped show/ link.
  if (host === "matterport.com" || host === "my.matterport.com") return parsed.toString();

  return null;
}

/**
 * Slugify a title into a /v/<slug>-safe token: lowercase, ASCII, hyphenated,
 * [a-z0-9-] only, collapsed/trimmed hyphens. Used for the create-slug default;
 * uniqueness (P2002) is handled by the action with a numeric suffix.
 */
export function slugify(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

/** Validate a final slug against the storage shape [a-z0-9-], 1–80 chars. */
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
