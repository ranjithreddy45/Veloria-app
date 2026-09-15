import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { getStorageDriver, ObjectNotFoundError, parseStorageRef } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/hr/handbook — stream the current Employee Handbook PDF.
 * Any signed-in user may read it (the handbook exists to be read by every
 * staff member); managing it is gated in handbook.actions (hr:write).
 *
 * The Document row holds either the legacy inline data-URL or, once object
 * storage is on, an `s3://<bucket>/<key>` ref — both are served here.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to read the handbook." }, { status: 401 });
  }

  const doc = await prisma.document.findFirst({
    where: { category: "HANDBOOK" },
    orderBy: { createdAt: "desc" },
    select: { url: true, fileName: true },
  });
  if (!doc?.url) {
    return NextResponse.json({ error: "No handbook is published." }, { status: 404 });
  }
  const disposition = `inline; filename="${doc.fileName || "employee-handbook.pdf"}"`;

  const ref = parseStorageRef(doc.url);
  if (ref) {
    try {
      const obj = await getStorageDriver().getObjectStream(ref.key, ref.bucket);
      const headers = new Headers({
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=300",
      });
      if (obj.contentLength != null) headers.set("Content-Length", String(obj.contentLength));
      return new NextResponse(obj.stream, { status: 200, headers });
    } catch (e) {
      if (e instanceof ObjectNotFoundError) {
        return NextResponse.json({ error: "No handbook is published." }, { status: 404 });
      }
      console.error("[HANDBOOK_GET]", e);
      return NextResponse.json({ error: "Could not read the handbook." }, { status: 502 });
    }
  }

  if (!doc.url.startsWith("data:application/pdf;base64,")) {
    return NextResponse.json({ error: "No handbook is published." }, { status: 404 });
  }

  const b64 = doc.url.slice(doc.url.indexOf(",") + 1);
  const bytes = Buffer.from(b64, "base64");
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.length),
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=300",
    },
  });
}
