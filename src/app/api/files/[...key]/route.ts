import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { getStorageDriver, isValidObjectKey, ObjectNotFoundError } from "@/lib/storage";
import { readS3Config } from "@/lib/storage/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/files/<key> — authenticated streaming proxy for object storage.
 *
 * File columns that were moved out of Postgres hold `s3://<bucket>/<key>`;
 * the display boundary turns that into this URL so the browser never sees a
 * bucket hostname or a presigned link. Any signed-in user may read (the same
 * rule as the inline data-URLs these replace, which any page could embed);
 * per-record access is enforced where the ref is handed out, not here, and
 * keys are unguessable (cuid-style ids).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key: parts } = await params;
  const key = (parts ?? []).join("/");
  if (!isValidObjectKey(key)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cfg = readS3Config();
  if (!cfg) {
    return NextResponse.json({ error: "Object storage is not configured." }, { status: 404 });
  }

  // The registry knows which bucket the key was written to (and its type);
  // both are optional — the configured bucket and the object's own headers
  // are enough on their own.
  let bucket = cfg.bucket;
  let registeredType: string | null = null;
  try {
    const row = await prisma.storedFile.findUnique({ where: { key }, select: { bucket: true, contentType: true } });
    if (row) {
      bucket = row.bucket;
      registeredType = row.contentType;
    }
  } catch {
    // Registry unavailable — fall through to the configured bucket.
  }

  try {
    const obj = await getStorageDriver().getObjectStream(key, bucket);
    const type = obj.contentType || registeredType || "application/octet-stream";
    // Uploads are user-controlled bytes served from the app origin: never let a
    // markup-capable type render inline with the session cookie in scope.
    const inline = !/^(image\/svg|text\/html|application\/xhtml|text\/xml|application\/xml)/i.test(type);
    const filename = key.slice(key.lastIndexOf("/") + 1);
    const headers = new Headers({
      "Content-Type": type,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    if (obj.contentLength != null) headers.set("Content-Length", String(obj.contentLength));
    if (obj.etag) headers.set("ETag", obj.etag);
    return new NextResponse(obj.stream, { status: 200, headers });
  } catch (e) {
    if (e instanceof ObjectNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[FILES_PROXY]", key, e);
    return NextResponse.json({ error: "Could not read the file." }, { status: 502 });
  }
}
