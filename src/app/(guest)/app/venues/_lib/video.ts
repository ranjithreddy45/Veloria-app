import { safeHttpUrl } from "./hall-info";

// ============================================================
// Hall video. YouTube (privacy-enhanced domain) and Vimeo play inline; any
// other web address is offered as a plain link. Nothing else ever goes into
// an iframe.
// ============================================================

export type VideoTarget =
  | { kind: "youtube" | "vimeo"; id: string; embedUrl: string; href: string }
  | { kind: "link"; href: string };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{1,12}$/;
const VIMEO_HASH = /^[0-9a-f]{6,32}$/i;

/** "90", "90s", "1m30s", "1h2m" → seconds; anything else → null. */
export function parseStartSeconds(raw: string | null | undefined): number | null {
  const s = raw?.trim().toLowerCase();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s) > 0 ? Number(s) : null;
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(s);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  const total = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return total > 0 ? total : null;
}

function youtubeId(u: URL, host: string): string | null {
  if (host === "youtu.be") return u.pathname.split("/")[1] || null;
  if (host !== "youtube.com" && host !== "youtube-nocookie.com" && host !== "music.youtube.com") return null;
  if (u.pathname === "/watch") return u.searchParams.get("v");
  return /^\/(?:embed|shorts|live|v)\/([^/]+)/.exec(u.pathname)?.[1] ?? null;
}

function vimeoIndex(parts: string[]): number {
  // …/video/ID or …/videos/ID (player, showcase, groups) — otherwise the first numeric segment.
  const marker = parts.findIndex((p) => p === "video" || p === "videos");
  if (marker >= 0 && VIMEO_ID.test(parts[marker + 1] ?? "")) return marker + 1;
  return parts.findIndex((p) => VIMEO_ID.test(p));
}

/** How to show a staff-entered video URL; null when it is not a web address. */
export function videoTarget(raw: string | null | undefined): VideoTarget | null {
  const href = safeHttpUrl(raw);
  if (!href) return null;
  const u = new URL(href);
  const host = u.hostname.toLowerCase().replace(/^(?:www|m)\./, "");

  const yt = youtubeId(u, host);
  if (yt && YOUTUBE_ID.test(yt)) {
    const start = parseStartSeconds(u.searchParams.get("t") ?? u.searchParams.get("start"));
    return { kind: "youtube", id: yt, embedUrl: `https://www.youtube-nocookie.com/embed/${yt}${start ? `?start=${start}` : ""}`, href };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    const at = vimeoIndex(parts);
    if (at >= 0) {
      const id = parts[at];
      const next = parts[at + 1];
      const hash = u.searchParams.get("h") ?? (next && VIMEO_HASH.test(next) ? next : null);
      const query = hash && VIMEO_HASH.test(hash) ? `?h=${hash}` : "";
      return { kind: "vimeo", id, embedUrl: `https://player.vimeo.com/video/${id}${query}`, href };
    }
  }

  return { kind: "link", href };
}
