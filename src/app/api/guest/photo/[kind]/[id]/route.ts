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
// ============================================================

export const dynamic = "force-dynamic";

function decodeDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  // A fresh copy: Buffer may sit on a shared pool, and Blob wants a plain ArrayBuffer-backed view.
  return { mime: m[1], bytes: new Uint8Array(Buffer.from(m[2], "base64")) };
}

export async function GET(req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return new NextResponse("Not found", { status: 404 });

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
  if (!url) return new NextResponse("Not found", { status: 404 });

  if (url.startsWith("data:")) {
    const d = decodeDataUrl(url);
    if (!d) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(new Blob([d.bytes], { type: d.mime }), {
      headers: {
        "Content-Type": d.mime,
        "Content-Length": String(d.bytes.byteLength),
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      },
    });
  }
  // Hosted or site-relative URL: let the browser fetch it directly.
  return NextResponse.redirect(new URL(url, req.url), 302);
}
