import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ============================================================
// Public photo route for the guest app.
//
// Uploads in this system are base64 data URLs stored in Postgres. Inlining
// them into a page would ship megabytes of markup to a phone, so the guest
// app references photos by id and this route streams the bytes with long
// cache headers. Only two sources are exposed, both already customer-facing:
//   g/<galleryItemId>  — GalleryItem marked public
//   p/<attachmentId>   — acquisition-deal PHOTO attached to a live venue
//
// SECURITY: the bytes are served from the app's own origin, where a stored
// "data:text/html" or SVG would run as a page of this site. So only PNG, JPEG,
// GIF and WebP data URLs are served (anything else is a 404), every response
// says nosniff and carries a sandboxing CSP, and a stored link is followed
// only when it is http(s).
// ============================================================

export const dynamic = "force-dynamic";

/** The only data-URL types this route serves. */
const SERVABLE_IMAGE_TYPES: ReadonlySet<string> = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

/** On every response: no type sniffing, and nothing from here may run as a page. */
const LOCKDOWN_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
};

function notFound(): NextResponse {
  return new NextResponse("Not found", { status: 404, headers: LOCKDOWN_HEADERS });
}

/** Decode a base64 data URL of a servable image type; null for anything else. */
function decodeImageDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  if (!SERVABLE_IMAGE_TYPES.has(mime)) return null;
  // A fresh copy: Buffer may sit on a shared pool, and Blob wants a plain ArrayBuffer-backed view.
  return { mime, bytes: new Uint8Array(Buffer.from(m[2], "base64")) };
}

export async function GET(req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return notFound();

  let url: string | null = null;
  if (kind === "g") {
    const g = await prisma.galleryItem.findFirst({ where: { id, isPublic: true }, select: { url: true, thumbnailUrl: true } });
    url = g ? g.thumbnailUrl || g.url : null;
  } else if (kind === "p") {
    const a = await prisma.acqAttachment.findFirst({
      where: { id, kind: "PHOTO", deal: { property: { deletedAt: null, venueId: { not: null } } } },
      select: { url: true },
    });
    url = a?.url ?? null;
  }
  if (!url) return notFound();

  if (/^data:/i.test(url)) {
    const d = decodeImageDataUrl(url);
    if (!d) return notFound();
    // Copy into a plain ArrayBuffer-backed array: Blob parts can't be views over a SharedArrayBuffer.
    return new NextResponse(new Blob([new Uint8Array(d.bytes)], { type: d.mime }), {
      headers: {
        ...LOCKDOWN_HEADERS,
        "Content-Type": d.mime,
        "Content-Length": String(d.bytes.byteLength),
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      },
    });
  }

  // Hosted or site-relative URL: let the browser fetch it directly, over http(s) only.
  let target: URL;
  try {
    target = new URL(url, req.url);
  } catch {
    return notFound();
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") return notFound();
  const res = NextResponse.redirect(target, 302);
  for (const [name, value] of Object.entries(LOCKDOWN_HEADERS)) res.headers.set(name, value);
  return res;
}
